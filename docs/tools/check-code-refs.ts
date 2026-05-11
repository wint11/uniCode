/**
 * 代码-文档关联检测工具
 *
 * 1. 收集所有文档中声明的 code_refs
 * 2. 计算每个代码文件的 SHA-256 哈希
 * 3. 与上次快照对比，找出变更
 * 4. 反查：列出因代码变更可能需要更新的文档
 *
 * 用法:
 *   npx tsx docs/tools/check-code-refs.ts              # 检测变更
 *   npx tsx docs/tools/check-code-refs.ts --update     # 检测并更新快照
 *   npx tsx docs/tools/check-code-refs.ts --init       # 仅创建初始快照（不报告变更）
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { parseFootMatter } from './lib/foot-matter';

const DOCS_DIR = join(process.cwd(), 'docs');
const HASHES_FILE = join(DOCS_DIR, 'data', 'code-hashes.json');

interface HashSnapshot {
  [filePath: string]: string; // 文件路径 → SHA-256
}

interface CodeDocMap {
  [filePath: string]: string[]; // 代码文件 → 关联的文档 slug 列表
}

interface DocInfo {
  slug: string;
  title: string;
  codeRefs: string[];
}

// 收集所有文档的 code_refs 关联
async function collectDocCodeRefs(): Promise<{ docs: DocInfo[]; map: CodeDocMap }> {
  const docs: DocInfo[] = [];
  const map: CodeDocMap = {};

  // 从数据库收集
  const dbPath = join(DOCS_DIR, 'data', 'docs.db');
  if (existsSync(dbPath)) {
    const db = new Database(dbPath);
    const rows = db.prepare('SELECT slug, title, content FROM docs').all() as {
      slug: string; title: string; content: string;
    }[];
    for (const row of rows) {
      // 优先读取 Foot Matter 中的 code_refs，回退到正文内联提取
      const fm = parseFootMatter(row.content);
      const refs = fm && fm.code_refs.length > 0
        ? fm.code_refs
        : extractCodeRefs(row.content);
      if (refs.length > 0) {
        docs.push({ slug: row.slug, title: row.title, codeRefs: refs });
        for (const ref of refs) {
          if (!map[ref]) map[ref] = [];
          map[ref].push(row.slug);
        }
      }
    }
    db.close();
  }

  // 从草稿区收集
  const draftFiles = await findMdFiles(join(DOCS_DIR, 'drafts'));
  for (const file of draftFiles) {
    const raw = await readFile(file, 'utf-8');
    const slug = relative(join(DOCS_DIR, 'drafts'), file).replace(/\\/g, '/').replace(/\.md$/, '');

    // 优先读取 Foot Matter 中的 code_refs，回退到正文内联提取
    const fm = parseFootMatter(raw);
    const refs = fm && fm.code_refs.length > 0
      ? fm.code_refs
      : extractCodeRefs(raw);

    if (refs.length > 0) {
      const titleMatch = raw.match(/^#\s+(.+)$/m);
      docs.push({ slug: `drafts/${slug}`, title: titleMatch?.[1] ?? slug, codeRefs: refs });
      for (const ref of refs) {
        if (!map[ref]) map[ref] = [];
        map[ref].push(`drafts/${slug}`);
      }
    }
  }

  return { docs, map };
}

// 从 markdown 内容中提取内联代码引用（如 `src/lib/docs/actions.ts`）
function extractCodeRefs(content: string): string[] {
  const refs: string[] = [];
  const regex = /`([^`]+\.(?:ts|tsx|js|jsx|css|json|sql))`/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const path = match[1];
    if (existsSync(join(process.cwd(), path))) {
      refs.push(path);
    }
  }
  return [...new Set(refs)]; // 去重
}

async function findMdFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
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

// 计算文件哈希
async function computeHashes(codeFiles: string[]): Promise<HashSnapshot> {
  const hashes: HashSnapshot = {};
  for (const file of codeFiles) {
    const absPath = join(process.cwd(), file);
    try {
      const raw = await readFile(absPath);
      hashes[file] = createHash('sha256').update(raw).digest('hex');
    } catch {
      hashes[file] = 'ERROR:FILE_NOT_FOUND';
    }
  }
  return hashes;
}

export interface CheckRefsResult {
  /** 关联的文档数量 */
  docCount: number;
  /** 关联的代码文件数量 */
  codeFileCount: number;
  /** 发生变更的代码文件 */
  changedFiles: string[];
  /** 受影响的文档 slug 列表 */
  affectedDocs: string[];
  /** 是否存在变更 */
  hasChanges: boolean;
}

export async function checkCodeRefs(options?: {
  silent?: boolean;
  update?: boolean;
  init?: boolean;
}): Promise<CheckRefsResult> {
  const silent = options?.silent ?? false;
  const shouldUpdate = options?.update ?? false;
  const isInit = options?.init ?? false;

  if (!silent) console.log('收集代码-文档关联...\n');

  const { docs, map } = await collectDocCodeRefs();
  const allCodeFiles = Object.keys(map);

  if (!silent) console.log(`关联统计: ${docs.length} 份文档覆盖 ${allCodeFiles.length} 个代码文件\n`);

  if (allCodeFiles.length === 0) {
    if (!silent) {
      console.log('未发现任何代码-文档关联。请在文档末尾的 Foot Matter 中添加 code_refs 字段。');
    }
    return { docCount: docs.length, codeFileCount: 0, changedFiles: [], affectedDocs: [], hasChanges: false };
  }

  // 计算当前哈希
  const currentHashes = await computeHashes(allCodeFiles);

  // 读取上次快照
  let previousHashes: HashSnapshot = {};
  try {
    previousHashes = JSON.parse(await readFile(HASHES_FILE, 'utf-8'));
  } catch {
    if (!silent) console.log('(无历史快照，将创建初始快照)\n');
  }

  // 对比
  const changedFiles: string[] = [];
  const addedFiles: string[] = [];
  const removedFiles: string[] = [];

  for (const file of allCodeFiles) {
    if (!previousHashes[file]) {
      addedFiles.push(file);
    } else if (previousHashes[file] !== currentHashes[file]) {
      changedFiles.push(file);
    }
  }
  for (const file of Object.keys(previousHashes)) {
    if (!currentHashes[file]) {
      removedFiles.push(file);
    }
  }

  const allChanged = [...changedFiles, ...addedFiles, ...removedFiles];

  // 反查文档
  const affectedDocs = new Set<string>();
  for (const file of allChanged) {
    for (const slug of (map[file] || [])) {
      affectedDocs.add(slug);
    }
  }

  // 输出报告
  if (!silent) {
    if (isInit) {
      console.log('初始快照已创建。');
    } else if (allChanged.length === 0) {
      console.log('未检测到代码变更，所有关联文档均为最新。');
    } else {
      console.log('── 代码变更检测 ──\n');
      for (const file of addedFiles) console.log(`  [新增] ${file}`);
      for (const file of changedFiles) console.log(`  [变更] ${file}`);
      for (const file of removedFiles) console.log(`  [删除] ${file}`);

      console.log(`\n── 需检查的文档 (${affectedDocs.size} 份) ──\n`);
      for (const slug of [...affectedDocs].sort()) {
        const doc = docs.find((d) => d.slug === slug);
        console.log(`  /docs/${slug}  —  ${doc?.title ?? slug}`);
      }
    }
  }

  // 保存快照
  if (shouldUpdate || isInit || Object.keys(previousHashes).length === 0) {
    await writeFile(HASHES_FILE, JSON.stringify(currentHashes, null, 2), 'utf-8');
    if (!silent) console.log('\n哈希快照已更新。');
  } else if (!silent && allChanged.length > 0) {
    console.log('\n提示: 使用 --update 更新哈希快照。');
  }

  return {
    docCount: docs.length,
    codeFileCount: allCodeFiles.length,
    changedFiles: allChanged,
    affectedDocs: [...affectedDocs],
    hasChanges: allChanged.length > 0,
  };
}

// 仅在直接运行时执行 CLI（被 tool.ts 引入时跳过）
if (process.argv[1]?.replace(/\\/g, '/').includes('docs/tools/check-code-refs')) {
  const args = process.argv.slice(2);
  checkCodeRefs({ update: args.includes('--update'), init: args.includes('--init') }).catch((err) => {
    console.error('检测失败:', err);
    process.exit(1);
  });
}
