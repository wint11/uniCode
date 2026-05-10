/**
 * 动态扫描 docs/ 目录，将所有非 drafts、非模板的 .md 文件迁移到 SQLite
 *
 * 用法: npx tsx docs/tools/migrate-to-db.ts
 */

import { readFile, readdir, unlink } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import matter from 'gray-matter';
import { getDb } from '../lib/db/schema';

const DOCS_DIR = join(process.cwd(), 'docs');

async function findFormalDocs(dir: string, baseDir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    // 跳过模板、drafts、隐藏目录、archive
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    if (entry.name === 'drafts' || entry.name === 'archive') continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findFormalDocs(fullPath, baseDir));
    } else if (extname(entry.name) === '.md') {
      results.push(relative(baseDir, fullPath).replace(/\\/g, '/'));
    }
  }

  return results;
}

function toStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'string') return v;
  return String(v ?? '');
}

async function main() {
  console.log('扫描正式文档目录...\n');

  const formalFiles = await findFormalDocs(DOCS_DIR, DOCS_DIR);

  if (formalFiles.length === 0) {
    console.log('没有需要迁移的正式文档。');
    return;
  }

  console.log(`发现 ${formalFiles.length} 份正式文档，开始迁移...\n`);

  const db = getDb();
  let count = 0;

  for (const relPath of formalFiles) {
    const filePath = join(DOCS_DIR, relPath);
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      console.log(`  [跳过] 文件无法读取: ${relPath}`);
      continue;
    }

    const parsed = matter(raw);
    const fm = parsed.data as Record<string, unknown>;
    const slug = relPath.replace(/\.md$/, '');
    const titleMatch = parsed.content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : relPath;

    db.prepare(`
      INSERT OR REPLACE INTO docs (slug, title, content, author, reviewer, status, last_reviewed, review_date, review_comment, review_history, target_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      slug,
      title,
      parsed.content,
      toStr(fm.author),
      toStr(fm.reviewer),
      toStr(fm.status) || 'published',
      toStr(fm.last_reviewed),
      toStr(fm.review_date),
      toStr(fm.review_comment),
      JSON.stringify(fm.review_history ?? []),
      toStr(fm.target_path),
    );

    await unlink(filePath);

    console.log(`  [迁移] ${relPath} → DB (slug: ${slug})`);
    count++;
  }

  console.log(`\n完成。迁移 ${count} 份文档。`);
}

main().catch((err) => {
  console.error('迁移失败:', err);
  process.exit(1);
});
