/**
 * 从数据库生成只读的发布文档快照
 *
 * 用法: npx tsx docs/tools/publish-docs.ts
 *
 * 将所有已发布的正式文档从 SQLite 导出到 docs/production/ 目录。
 * 该目录为只读快照，AI 无权修改。
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { getDb } from '../lib/db/schema';

const PUBLISHED_DIR = join(process.cwd(), 'docs', 'production');

interface DbRow {
  slug: string;
  title: string;
  content: string;
  author: string;
  reviewer: string;
  status: string;
  last_reviewed: string;
  review_date: string;
  review_comment: string;
  review_history: string;
}

const YAML_ORDER = ['author', 'reviewer', 'status', 'last_reviewed', 'review_date', 'review_comment', 'review_history'];

function buildFrontmatter(row: DbRow): string {
  const lines = ['---'];
  const data: Record<string, unknown> = {
    author: row.author,
    reviewer: row.reviewer,
    status: row.status,
    last_reviewed: row.last_reviewed,
    review_date: row.review_date,
    review_comment: row.review_comment,
    review_history: JSON.parse(row.review_history || '[]'),
  };
  for (const key of YAML_ORDER) {
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

export async function publishDocs(): Promise<number> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM docs WHERE status = 'published'
    ORDER BY title COLLATE NOCASE
  `).all() as DbRow[];

  if (rows.length === 0) return 0;

  let count = 0;
  for (const row of rows) {
    const frontmatter = buildFrontmatter(row);
    const fileContent = frontmatter + row.content;
    const filePath = join(PUBLISHED_DIR, `${row.slug}.md`);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(filePath, fileContent, 'utf-8');
    count++;
  }

  // 生成索引
  const indexPath = join(PUBLISHED_DIR, 'index.md');
  const indexLines = [
    '---',
    'author: system',
    'status: published',
    'last_reviewed: ' + new Date().toISOString().split('T')[0],
    '---',
    '',
    '# 发布文档索引',
    '',
    '> 此目录为数据库自动生成，只读。AI 禁止修改。',
    '',
  ];
  for (const row of rows) {
    indexLines.push(`- [${row.title}](${row.slug}.md)`);
  }
  await writeFile(indexPath, indexLines.join('\n'), 'utf-8');

  return count;
}

async function main() {
  console.log('生成发布文档快照...\n');

  const count = await publishDocs();

  console.log(`\n完成。共生成 ${count} 份文档快照到 docs/production/ 目录。`);
}

// 仅 CLI 直接运行时执行，被 import 时不触发
const runningDirectly = process.argv.length > 1
  && process.argv[1]?.replace(/\\/g, '/').includes('docs/tools/publish-docs');
if (runningDirectly) {
  main().catch((err) => {
    console.error('快照生成失败:', err);
    process.exit(1);
  });
}
