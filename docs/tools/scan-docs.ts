/**
 * 文档扫描工具 — 检查 docs/ 目录下所有 .md 文件的合规性与引用完整性
 *
 * 用法:
 *   npx tsx docs/tools/scan-docs.ts
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import matter from 'gray-matter';
import { parseFootMatter } from './lib/foot-matter';
import { getAllDbSlugs } from '../lib/db/docs';

const DOCS_DIR = join(process.cwd(), 'docs');
const REQUIRED_FIELDS = ['author', 'status', 'review_date', 'review_comment', 'target_path'] as const;
const VALID_STATUSES = ['draft', 'reviewed', 'published', 'rejected'] as const;
const STALE_DAYS = 90;

interface ScanIssue {
  file: string;
  type: 'missing_field' | 'invalid_status' | 'stale' | 'parse_error' | 'broken_link' | 'draft_link';
  detail: string;
}

interface ScanResult {
  total: number;
  ok: number;
  issues: ScanIssue[];
}

async function findMdFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    if (entry.name === 'production' || entry.name === 'archive') continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findMdFiles(fullPath));
    } else if (extname(entry.name) === '.md') {
      results.push(fullPath);
    }
  }

  return results;
}

function toStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'string') return v;
  return String(v ?? '');
}

function checkStaleness(lastReviewed: string | Date): boolean {
  const reviewedDate = lastReviewed instanceof Date ? lastReviewed : new Date(lastReviewed);
  if (isNaN(reviewedDate.getTime())) return true;
  const daysAgo = (Date.now() - reviewedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysAgo > STALE_DAYS;
}

// 从 "drafts/guides/dev/code-style" 收集所有已知 slug
function collectAllSlugs(files: string[]): Set<string> {
  const slugs = new Set<string>();
  for (const file of files) {
    const rel = relative(DOCS_DIR, file).replace(/\\/g, '/');
    const slug = rel.replace(/\.md$/, '');
    slugs.add(slug);
  }
  return slugs;
}

// 构建 target_path → 文件 slug 的映射（用于解析 Foot Matter doc_refs）
async function buildTargetSlugMap(files: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const file of files) {
    try {
      const raw = await readFile(file, 'utf-8');
      const parsed = matter(raw);
      const targetPath = (parsed.data as Record<string, unknown>).target_path;
      if (typeof targetPath === 'string' && targetPath.trim()) {
        const rel = relative(DOCS_DIR, file).replace(/\\/g, '/');
        map.set(targetPath.trim(), rel.replace(/\.md$/, ''));
      }
    } catch {
      // 解析失败，跳过
    }
  }
  return map;
}

// 解析 markdown 链接，返回 [(链接文本, 目标, 在文件中的行号)]
function extractLinks(content: string): Array<{ text: string; target: string }> {
  const links: Array<{ text: string; target: string }> = [];
  const regex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const target = match[2];
    // 跳过外部链接和纯锚点
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#')) continue;
    links.push({ text: match[1], target });
  }
  return links;
}

// 检查一个相对链接是否有效
function checkLink(
  target: string,
  currentFile: string,
  allSlugs: Set<string>,
): { type: 'ok' | 'broken' | 'draft_ref'; resolvedPath: string } {
  // 去掉查询参数和锚点
  const cleanTarget = target.split('?')[0].split('#')[0];
  const currentFileNorm = currentFile.replace(/\\/g, '/');

  // 情况1: 指向文件系统中的文件（如 ./file.md, ../dir/file.md）
  if (cleanTarget.endsWith('.md') || cleanTarget.includes('/')) {
    const currentDir = dirname(currentFileNorm);
    const resolved = join(currentDir, cleanTarget).replace(/\\/g, '/');

    // 检查是否为 docs 下的实际文件
    const absPath = join(DOCS_DIR, resolved.startsWith('docs/') ? resolved.slice(5) : resolved);
    if (existsSync(absPath)) {
      if (resolved.includes('drafts/')) return { type: 'draft_ref', resolvedPath: resolved };
      return { type: 'ok', resolvedPath: resolved };
    }

    // 尝试按 slug 查找
    const asSlug = cleanTarget.replace(/\.md$/, '');
    if (allSlugs.has(asSlug)) {
      if (asSlug.includes('drafts/')) return { type: 'draft_ref', resolvedPath: asSlug };
      return { type: 'ok', resolvedPath: asSlug };
    }
  }

  // 情况2: 纯 slug（如 "guides/dev/code-style"）
  if (allSlugs.has(cleanTarget)) {
    if (cleanTarget.includes('drafts/')) return { type: 'draft_ref', resolvedPath: cleanTarget };
    return { type: 'ok', resolvedPath: cleanTarget };
  }

  // 情况3: 检查文件是否存在
  const absPath = join(dirname(currentFile), cleanTarget);
  if (existsSync(absPath)) {
    return { type: 'ok', resolvedPath: relative(DOCS_DIR, absPath).replace(/\\/g, '/') };
  }

  // 查 /docs/ 前缀
  if (cleanTarget.startsWith('/docs/')) {
    const slug = cleanTarget.slice(6);
    if (allSlugs.has(slug)) {
      if (slug.includes('drafts/')) return { type: 'draft_ref', resolvedPath: slug };
      return { type: 'ok', resolvedPath: slug };
    }
  }

  return { type: 'broken', resolvedPath: cleanTarget };
}

async function scanFile(filePath: string, allSlugs: Set<string>, targetSlugMap: Map<string, string>): Promise<ScanIssue[]> {
  const relativePath = relative(process.cwd(), filePath);
  const issues: ScanIssue[] = [];

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    issues.push({ file: relativePath, type: 'parse_error', detail: '无法读取文件' });
    return issues;
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    issues.push({ file: relativePath, type: 'parse_error', detail: 'Front Matter 解析失败' });
    return issues;
  }

  const fm = parsed.data as Record<string, unknown>;

  // 检查必填字段
  for (const field of REQUIRED_FIELDS) {
    // review_date 和 review_comment 允许空值（审核时填充）
    if (field === 'review_date' || field === 'review_comment') {
      if (!(field in fm)) {
        issues.push({ file: relativePath, type: 'missing_field', detail: `缺少必填字段: ${field}` });
      }
      continue;
    }
    const val = toStr(fm[field]);
    if (!val.trim()) {
      issues.push({ file: relativePath, type: 'missing_field', detail: `缺少必填字段: ${field}` });
    }
  }

  // 检查 status 合法性
  const statusVal = toStr(fm.status);
  if (statusVal && !(VALID_STATUSES as readonly string[]).includes(statusVal)) {
    issues.push({ file: relativePath, type: 'invalid_status', detail: `无效 status: "${statusVal}"（合法值: ${VALID_STATUSES.join(', ')}）` });
  }

  // 检查时效性
  const lastReviewedVal = toStr(fm.last_reviewed);
  if (lastReviewedVal && checkStaleness(lastReviewedVal)) {
    issues.push({ file: relativePath, type: 'stale', detail: `last_reviewed 为 ${lastReviewedVal}，超过 ${STALE_DAYS} 天未复审` });
  }

  // 引用完整性检查
  const docRelativePath = relative(DOCS_DIR, filePath);
  const links = extractLinks(parsed.content);
  for (const link of links) {
    const result = checkLink(link.target, docRelativePath, allSlugs);
    if (result.type === 'broken') {
      issues.push({ file: relativePath, type: 'broken_link', detail: `死链: [${link.text}](${link.target}) → 目标不存在` });
    } else if (result.type === 'draft_ref') {
      // 仅当正式文档引用 drafts 时警告（drafts 内部互相引用不警告）
      if (!docRelativePath.replace(/\\/g, '/').startsWith('drafts/')) {
        issues.push({ file: relativePath, type: 'draft_link', detail: `引用了 drafts 中的文档: [${link.text}](${link.target}) → 文档可能已晋升，需更新引用` });
      }
    }
  }

  // Foot Matter 引用完整性检查
  const footMatter = parseFootMatter(raw);
  if (footMatter) {
    // 检查 doc_refs 是否指向有效文档
    for (const docRef of footMatter.doc_refs) {
      // 将 target_path 引用解析为实际文件的 slug
      const resolvedRef = targetSlugMap.get(docRef) || docRef;
      const result = checkLink(resolvedRef, docRelativePath, allSlugs);
      if (result.type === 'broken') {
        issues.push({ file: relativePath, type: 'broken_link', detail: `Foot Matter doc_refs 死链: "${docRef}" → 文档不存在` });
      } else if (result.type === 'draft_ref') {
        if (!docRelativePath.replace(/\\/g, '/').startsWith('drafts/')) {
          issues.push({ file: relativePath, type: 'draft_link', detail: `Foot Matter doc_refs 引用了 drafts 文档: "${docRef}" → 可能已晋升，需更新引用` });
        }
      }
    }

    // 检查 code_refs 是否指向存在的文件
    for (const codeRef of footMatter.code_refs) {
      const absPath = join(process.cwd(), codeRef);
      if (!existsSync(absPath)) {
        issues.push({ file: relativePath, type: 'broken_link', detail: `Foot Matter code_refs 死链: "${codeRef}" → 文件不存在` });
      }
    }
  }

  return issues;
}

export async function scanDocs(options?: { silent?: boolean }): Promise<ScanResult> {
  const silent = options?.silent ?? false;
  if (!silent) console.log('文档扫描中（含引用完整性检查）...\n');

  const files = await findMdFiles(DOCS_DIR);
  const allSlugs = collectAllSlugs(files);
  const targetSlugMap = await buildTargetSlugMap(files);

  // 合并数据库中的文档 slug（如自动入库的变更日志）
  try {
    const dbSlugs = getAllDbSlugs();
    for (const s of dbSlugs) {
      allSlugs.add(s);
      targetSlugMap.set(s, s); // DB 文档的 slug 直接可用
    }
  } catch {
    // 数据库可能未初始化
  }

  const result: ScanResult = { total: files.length, ok: 0, issues: [] };

  for (const file of files) {
    const issues = await scanFile(file, allSlugs, targetSlugMap);
    if (issues.length === 0) {
      result.ok++;
    } else {
      result.issues.push(...issues);
    }
  }

  if (!silent) {
    console.log(`总计: ${result.total}  合规: ${result.ok}  问题: ${result.issues.length}\n`);

    if (result.issues.length > 0) {
      console.log('── 问题明细 ──\n');
      for (const issue of result.issues) {
        const tag: Record<string, string> = {
          missing_field: '缺字段',
          invalid_status: '状态错',
          stale: '过期',
          parse_error: '解析错',
          broken_link: '死链',
          draft_link: '草稿链',
        };
        console.log(`  [${tag[issue.type] ?? issue.type}] ${issue.file}`);
        console.log(`         ${issue.detail}\n`);
      }
    } else {
      console.log('全部文档合规。');
    }
  }

  return result;
}

// 仅在直接运行时执行 CLI（被 tool.ts 引入时跳过）
if (process.argv[1]?.replace(/\\/g, '/').includes('docs/tools/scan-docs')) {
  scanDocs().then((result) => {
    if (result.issues.length > 0) process.exit(1);
  }).catch((err) => {
    console.error('扫描失败:', err);
    process.exit(1);
  });
}
