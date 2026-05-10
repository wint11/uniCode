'use server';

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import matter from 'gray-matter';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import type { DocStatus, ReviewRecord } from './types';
import { getAllDocs } from './index';
import { insertDoc, updateDocStatus as updateDbDocStatus, deleteDoc as deleteDbDoc, getAllDbSlugs, getDbDoc } from './db/docs';
import { publishDocs } from '../tools/publish-docs';

const DOCS_DIR = join(process.cwd(), 'docs');
const DATA_DIR = join(DOCS_DIR, 'data');
const REJECTED_FILE = join(DATA_DIR, '_rejected.json');
const JWT_SECRET = new TextEncoder().encode(
  process.env.APP_SECRET || 'unicode-dev-secret-change-in-production',
);

// ============================================================
//  驳回追踪文件读写
// ============================================================
interface RejectedEntry {
  slug: string;
  title: string;
  rejected_date: string;
  rejected_by: string;
  reason: string;
}

async function readRejected(): Promise<Record<string, RejectedEntry>> {
  try {
    const raw = await readFile(REJECTED_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeRejected(data: Record<string, RejectedEntry>): Promise<void> {
  await writeFile(REJECTED_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ============================================================
//  认证守卫 — 替换为真实认证系统时只需改此函数
// ============================================================
async function getCurrentUser(): Promise<{ id: string; role: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: (payload.username as string) || 'unknown',
      role: (payload.role as string) || 'viewer',
    };
  } catch {
    return null;
  }
}

// ============================================================
//  权限断言
// ============================================================
function assertAuth(user: { id: string; role: string } | null): asserts user is { id: string; role: string } {
  if (!user) {
    throw new Error('AUTH_REQUIRED');
  }
}

function assertCanReview(user: { id: string; role: string }): void {
  const allowedRoles = ['admin', 'reviewer', 'editor'];
  if (!allowedRoles.includes(user.role)) {
    throw new Error('INSUFFICIENT_PERMISSION');
  }
}

// ============================================================
//  Front Matter 读写工具
// ============================================================
const YAML_SORT_ORDER = ['author', 'reviewer', 'status', 'last_reviewed', 'review_date', 'review_comment', 'review_history', 'target_path'];

function buildFrontmatterStr(data: Record<string, unknown>): string {
  const lines = ['---'];
  for (const key of YAML_SORT_ORDER) {
    if (key in data) {
      const val = data[key];
      if (typeof val === 'string') {
        lines.push(`${key}: ${val || ''}`);
      } else {
        lines.push(`${key}: ${JSON.stringify(val)}`);
      }
    }
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

async function readFrontMatter(filePath: string): Promise<{ data: Record<string, unknown>; content: string }> {
  const raw = await readFile(filePath, 'utf-8');
  const parsed = matter(raw);
  return { data: parsed.data as Record<string, unknown>, content: parsed.content };
}

async function writeFrontMatter(filePath: string, data: Record<string, unknown>, content: string): Promise<void> {
  // 按指定顺序排列 key
  const ordered: Record<string, unknown> = {};
  for (const key of YAML_SORT_ORDER) {
    if (key in data) ordered[key] = data[key];
  }
  for (const key of Object.keys(data)) {
    if (!(key in ordered)) ordered[key] = data[key];
  }
  const output = matter.stringify(content, ordered);
  await writeFile(filePath, output, 'utf-8');
}

// ============================================================
//  审核操作——唯一入口
// ============================================================
export interface ReviewResult {
  success: boolean;
  error?: string;
}

// ============================================================
//  判断文档存储位置
// ============================================================
function isInDb(entry: { relativePath: string }): boolean {
  return !entry.relativePath; // DB 文档无文件系统路径
}

async function getReviewData(
  entry: { slug: string; relativePath: string },
): Promise<{ data: Record<string, unknown>; content: string; source: 'db' | 'file' }> {
  if (isInDb(entry)) {
    const dbDoc = getDbDoc(entry.slug);
    if (!dbDoc) throw new Error('DB 文档读取失败');
    return {
      data: {
        author: dbDoc.frontmatter.author,
        reviewer: dbDoc.frontmatter.reviewer,
        status: dbDoc.frontmatter.status,
        last_reviewed: dbDoc.frontmatter.last_reviewed,
        review_date: dbDoc.frontmatter.review_date,
        review_comment: dbDoc.frontmatter.review_comment,
        review_history: dbDoc.frontmatter.review_history,
        target_path: dbDoc.frontmatter.target_path,
      },
      content: dbDoc.content,
      source: 'db',
    };
  } else {
    const filePath = join(DOCS_DIR, entry.relativePath);
    if (!filePath.startsWith(DOCS_DIR)) throw new Error('非法路径');
    const { data, content } = await readFrontMatter(filePath);
    return { data, content, source: 'file' };
  }
}

async function saveReviewData(
  entry: { slug: string; relativePath: string; title: string },
  data: Record<string, unknown>,
  content: string,
): Promise<void> {
  if (isInDb(entry)) {
    insertDoc({
      slug: entry.slug,
      title: entry.title,
      content,
      author: typeof data.author === 'string' ? data.author : '',
      reviewer: typeof data.reviewer === 'string' ? data.reviewer : '',
      status: (typeof data.status === 'string' ? data.status : 'draft'),
      last_reviewed: typeof data.last_reviewed === 'string' ? data.last_reviewed : '',
      review_date: typeof data.review_date === 'string' ? data.review_date : '',
      review_comment: typeof data.review_comment === 'string' ? data.review_comment : '',
      review_history: Array.isArray(data.review_history) ? data.review_history as ReviewRecord[] : [],
      target_path: typeof data.target_path === 'string' ? data.target_path : '',
    });
  } else {
    const filePath = join(DOCS_DIR, entry.relativePath);
    await writeFrontMatter(filePath, data, content);
  }
}

// ============================================================
//  审核操作
// ============================================================
// approveDoc = 通过审核 + 自动发布 + 自动晋升（drafts 文档移入数据库）
export async function approveDoc(slug: string, comment: string): Promise<ReviewResult> {
  try {
    const user = await getCurrentUser();
    assertAuth(user);
    assertCanReview(user);

    const allDocs = await getAllDocs();
    const entry = allDocs.find((d) => d.slug === slug);
    if (!entry) return { success: false, error: '文档不存在' };

    const today = new Date().toISOString().split('T')[0];
    const record: ReviewRecord = { date: today, reviewer: user.id, action: 'published', comment: comment || '' };

    // 文件系统 draft 且设置了 target_path — 先晋升到数据库
    if (entry.relativePath && entry.frontmatter.target_path) {
      const targetPath = entry.frontmatter.target_path;
      const newSlug = targetPath.replace(/\.md$/, '');

      // 检查目标 slug 是否已被占用
      const existingDbDoc = getDbDoc(newSlug);
      if (existingDbDoc) {
        return { success: false, error: `目标位置已被占用: ${newSlug}` };
      }

      const oldPath = join(DOCS_DIR, entry.relativePath);
      if (!oldPath.startsWith(DOCS_DIR)) return { success: false, error: '非法路径' };

      const { data: fileData, content } = await readFrontMatter(oldPath);

      const history: ReviewRecord[] = Array.isArray(fileData.review_history) ? fileData.review_history : [];
      history.push(record);

      // 插入数据库
      insertDoc({
        slug: newSlug,
        title: entry.title,
        content,
        author: typeof fileData.author === 'string' ? fileData.author : String(fileData.author || ''),
        reviewer: user.id,
        status: 'published',
        last_reviewed: today,
        review_date: today,
        review_comment: comment || '',
        review_history: history,
        target_path: '',
      });

      // 删除旧文件
      const { unlink } = await import('node:fs/promises');
      await unlink(oldPath);

      // 扫描项目更新引用
      const oldSlug = entry.slug;
      let updatedCount = 0;
      const allProjectFiles = await findTextFiles(ROOT_DIR);

      for (const filePath of allProjectFiles) {
        let raw: string;
        try { raw = await readFile(filePath, 'utf-8'); } catch { continue; }

        let fmData: Record<string, unknown> | null = null;
        let bodyContent = raw;
        if (filePath.endsWith('.md')) {
          try {
            const parsed = matter(raw);
            fmData = parsed.data as Record<string, unknown>;
            bodyContent = parsed.content;
          } catch { /* 纯文本 */ }
        }

        const replacementPairs: [string, string][] = [
          [`docs/${entry.relativePath}`, `docs/${targetPath}`],
          [entry.relativePath, targetPath],
          [oldSlug, newSlug],
          [`/docs/${oldSlug}`, `/docs/${newSlug}`],
        ];

        let changed = false;
        for (const [old, replacement] of replacementPairs) {
          if (old !== replacement && bodyContent.includes(old)) {
            bodyContent = bodyContent.split(old).join(replacement);
            changed = true;
          }
        }

        if (changed) {
          if (fmData) {
            await writeFrontMatter(filePath, fmData, bodyContent);
          } else {
            await writeFile(filePath, bodyContent, 'utf-8');
          }
          updatedCount++;
        }
      }

      // 保存重定向记录 — 先清理所有可能产生闭环的旧条目
      const redirectsPath = join(DATA_DIR, '_redirects.json');
      let redirects: Record<string, string> = {};
      try {
        const existing = await readFile(redirectsPath, 'utf-8');
        redirects = JSON.parse(existing);
      } catch { /* 文件不存在 */ }
      // 删除所有指向 oldSlug 或 newSlug 的重定向（彻底防闭环）
      for (const [key, value] of Object.entries(redirects)) {
        if (value === oldSlug || value === newSlug || key === newSlug) {
          delete redirects[key];
        }
      }
      redirects[oldSlug] = newSlug;
      await writeFile(redirectsPath, JSON.stringify(redirects, null, 2), 'utf-8');

      // 清除驳回追踪
      const rejected = await readRejected();
      if (rejected[slug]) { delete rejected[slug]; await writeRejected(rejected); }

      // 自动更新发布快照
      await publishDocs().catch(() => {});
      revalidatePath('/docs');
      return { success: true, error: updatedCount > 0 ? `已更新 ${updatedCount} 个项目文件中的引用` : undefined };
    }

    // DB 文档 — 直接改状态
    const { data, content } = await getReviewData(entry);
    const history: ReviewRecord[] = Array.isArray(data.review_history) ? data.review_history : [];
    history.push(record);

    data.status = 'published';
    data.reviewer = user.id;
    data.last_reviewed = today;
    data.review_date = today;
    data.review_comment = comment || '';
    data.review_history = history;

    await saveReviewData(entry, data, content);

    const rejected = await readRejected();
    if (rejected[slug]) { delete rejected[slug]; await writeRejected(rejected); }

    // 自动更新发布快照
    await publishDocs().catch(() => {});
    revalidatePath('/docs');
    return { success: true };
  } catch (err) {
    if ((err as Error).message === 'AUTH_REQUIRED') return { success: false, error: '请先登录' };
    if ((err as Error).message === 'INSUFFICIENT_PERMISSION') return { success: false, error: '无审核权限' };
    return { success: false, error: `操作失败: ${(err as Error).message}` };
  }
}

// 批量审批：一次性通过多篇文档
export async function batchApproveDocs(slugs: string[]): Promise<ReviewResult> {
  const errors: string[] = [];
  for (const slug of slugs) {
    const result = await approveDoc(slug, '');
    if (!result.success) {
      errors.push(`${slug}: ${result.error}`);
    }
  }
  // 最后统一更新发布快照
  await publishDocs().catch(() => {});
  revalidatePath('/docs');
  if (errors.length > 0) {
    return { success: false, error: `${slugs.length - errors.length}/${slugs.length} 成功，失败: ${errors.join('; ')}` };
  }
  return { success: true };
}

export async function rejectDoc(slug: string, comment: string): Promise<ReviewResult> {
  if (!comment.trim()) return { success: false, error: '拒绝时必须填写驳回理由' };

  try {
    const user = await getCurrentUser();
    assertAuth(user);
    assertCanReview(user);

    const allDocs = await getAllDocs();
    const entry = allDocs.find((d) => d.slug === slug);
    if (!entry) return { success: false, error: '文档不存在' };

    const today = new Date().toISOString().split('T')[0];
    const record: ReviewRecord = { date: today, reviewer: user.id, action: 'rejected', comment };

    // DB 文档 — 删除 DB 记录，写回 drafts 文件（平级）
    if (!entry.relativePath) {
      const dbDoc = getDbDoc(slug);
      if (!dbDoc) return { success: false, error: 'DB 文档读取失败' };

      const history: ReviewRecord[] = [...dbDoc.frontmatter.review_history, record];
      // 平级文件名：把 / 替换为 -
      const draftFile = slug.replace(/\//g, '-');
      const draftSlug = `drafts/${draftFile}`;
      const draftPath = join(DOCS_DIR, `${draftSlug}.md`);

      const frontmatter = buildFrontmatterStr({
        author: dbDoc.frontmatter.author,
        reviewer: user.id,
        status: 'rejected',
        last_reviewed: today,
        review_date: today,
        review_comment: comment,
        review_history: history,
        target_path: slug,
      });

      const { writeFile: _writeFile } = await import('node:fs/promises');
      await _writeFile(draftPath, frontmatter + dbDoc.content, 'utf-8');

      deleteDbDoc(slug);

      // 添加反向重定向：旧 DB 路径 → 新 draft 路径（清理所有相关条目防闭环）
      const redirectsPath = join(DATA_DIR, '_redirects.json');
      try {
        const raw = await readFile(redirectsPath, 'utf-8');
        const redirects = JSON.parse(raw);
        for (const [key, value] of Object.entries(redirects)) {
          if (value === slug || value === draftSlug || key === draftSlug) {
            delete redirects[key];
          }
        }
        redirects[slug] = draftSlug;
        await writeFile(redirectsPath, JSON.stringify(redirects, null, 2), 'utf-8');
      } catch { /* 文件不存在 */ }

      const rejected = await readRejected();
      rejected[draftSlug] = { slug: draftSlug, title: entry.title, rejected_date: today, rejected_by: user.id, reason: comment };
      await writeRejected(rejected);

      revalidatePath('/docs');
      return { success: true };
    }

    // 文件系统文档 — 直接改 frontmatter
    const { data, content } = await getReviewData(entry);
    const history: ReviewRecord[] = Array.isArray(data.review_history) ? data.review_history : [];
    history.push(record);

    data.status = 'rejected';
    data.reviewer = user.id;
    data.last_reviewed = today;
    data.review_date = today;
    data.review_comment = comment;
    data.review_history = history;

    await saveReviewData(entry, data, content);

    const rejected = await readRejected();
    rejected[slug] = { slug, title: entry.title, rejected_date: today, rejected_by: user.id, reason: comment };
    await writeRejected(rejected);

    revalidatePath('/docs');
    return { success: true };
  } catch (err) {
    if ((err as Error).message === 'AUTH_REQUIRED') return { success: false, error: '请先登录' };
    if ((err as Error).message === 'INSUFFICIENT_PERMISSION') return { success: false, error: '无审核权限' };
    return { success: false, error: `操作失败: ${(err as Error).message}` };
  }
}
export async function unpublishDoc(slug: string): Promise<ReviewResult> {
  try {
    const user = await getCurrentUser();
    assertAuth(user);
    assertCanReview(user);

    const allDocs = await getAllDocs();
    const entry = allDocs.find((d) => d.slug === slug);
    if (!entry) return { success: false, error: '文档不存在' };

    const { data, content } = await getReviewData(entry);

    const today = new Date().toISOString().split('T')[0];
    const record: ReviewRecord = { date: today, reviewer: user.id, action: 'unpublished', comment: '' };
    const history: ReviewRecord[] = Array.isArray(data.review_history) ? data.review_history : [];
    history.push(record);

    data.status = 'draft';
    data.last_reviewed = today;
    data.review_date = today;
    data.review_history = history;

    await saveReviewData(entry, data, content);
    revalidatePath('/docs');
    return { success: true };
  } catch (err) {
    if ((err as Error).message === 'AUTH_REQUIRED') return { success: false, error: '请先登录' };
    if ((err as Error).message === 'INSUFFICIENT_PERMISSION') return { success: false, error: '无审核权限' };
    return { success: false, error: `操作失败: ${(err as Error).message}` };
  }
}

// ============================================================
//  重新提交 — 作者修改后将驳回文档改回草稿状态
// ============================================================
export async function resubmitDoc(slug: string): Promise<ReviewResult> {
  try {
    const user = await getCurrentUser();
    assertAuth(user);

    const allDocs = await getAllDocs();
    const entry = allDocs.find((d) => d.slug === slug);
    if (!entry) return { success: false, error: '文档不存在' };

    if (entry.frontmatter.status !== 'rejected') {
      return { success: false, error: '仅已驳回的文档可以重新提交' };
    }

    const { data, content } = await getReviewData(entry);
    data.status = 'draft';
    data.review_comment = '';
    data.last_reviewed = new Date().toISOString().split('T')[0];

    await saveReviewData(entry, data, content);

    const rejected = await readRejected();
    delete rejected[slug];
    await writeRejected(rejected);

    revalidatePath('/docs');
    return { success: true };
  } catch (err) {
    if ((err as Error).message === 'AUTH_REQUIRED') return { success: false, error: '请先登录' };
    return { success: false, error: `操作失败: ${(err as Error).message}` };
  }
}

// ============================================================
//  获取驳回列表 — 供前端展示
// ============================================================
export async function getRejectedDocs(): Promise<RejectedEntry[]> {
  const data = await readRejected();
  return Object.values(data);
}

// ============================================================
//  文档晋升 — 从 drafts 移入数据库，并更新全部引用
// ============================================================
const ROOT_DIR = join(process.cwd());

// 需要在晋升时扫描的文本文件扩展名
const SCAN_EXTENSIONS = new Set(['.md', '.ts', '.tsx', '.json', '.css', '.js', '.mjs']);

// 跳过的目录
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.claude', '.trae', '.qoder']);

async function findTextFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findTextFiles(fullPath));
    } else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}
