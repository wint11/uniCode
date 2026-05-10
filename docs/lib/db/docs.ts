import { getDb } from './schema';
import type { DocEntry, DocFrontMatter, ReviewRecord } from '../types';

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
  target_path: string;
}

function rowToDocEntry(row: DbRow): DocEntry {
  const frontmatter: DocFrontMatter = {
    author: row.author,
    reviewer: row.reviewer,
    status: row.status as DocFrontMatter['status'],
    last_reviewed: row.last_reviewed,
    review_date: row.review_date,
    review_comment: row.review_comment,
    review_history: JSON.parse(row.review_history || '[]') as ReviewRecord[],
    target_path: row.target_path,
  };

  const reviewedDate = new Date(frontmatter.last_reviewed);
  const daysAgo = isNaN(reviewedDate.getTime())
    ? Infinity
    : (Date.now() - reviewedDate.getTime()) / (1000 * 60 * 60 * 24);

  return {
    slug: row.slug,
    relativePath: '', // DB 文档没有文件系统路径
    frontmatter,
    title: row.title,
    isStale: daysAgo > 90,
  };
}

export function getAllPublishedDocs(): DocEntry[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM docs WHERE status IN ('reviewed', 'published')
    ORDER BY title COLLATE NOCASE
  `).all() as DbRow[];
  return rows.map(rowToDocEntry);
}

export function getAllDbDocs(): DocEntry[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM docs ORDER BY title COLLATE NOCASE').all() as DbRow[];
  return rows.map(rowToDocEntry);
}

export function getDbDoc(slug: string): (DocEntry & { content: string }) | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM docs WHERE slug = ?').get(slug) as DbRow | undefined;
  if (!row) return null;
  return { ...rowToDocEntry(row), content: row.content };
}

export function insertDoc(doc: {
  slug: string;
  title: string;
  content: string;
  author: string;
  reviewer: string;
  status: string;
  last_reviewed: string;
  review_date: string;
  review_comment: string;
  review_history: ReviewRecord[];
  target_path: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO docs (slug, title, content, author, reviewer, status, last_reviewed, review_date, review_comment, review_history, target_path, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    doc.slug,
    doc.title,
    doc.content,
    doc.author,
    doc.reviewer,
    doc.status,
    doc.last_reviewed,
    doc.review_date,
    doc.review_comment,
    JSON.stringify(doc.review_history),
    doc.target_path,
  );
}

export function updateDocStatus(
  slug: string,
  updates: {
    status?: string;
    reviewer?: string;
    last_reviewed?: string;
    review_date?: string;
    review_comment?: string;
    review_history?: ReviewRecord[];
  },
): boolean {
  const db = getDb();
  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const params: unknown[] = [];

  if (updates.status !== undefined) { sets.push('status = ?'); params.push(updates.status); }
  if (updates.reviewer !== undefined) { sets.push('reviewer = ?'); params.push(updates.reviewer); }
  if (updates.last_reviewed !== undefined) { sets.push('last_reviewed = ?'); params.push(updates.last_reviewed); }
  if (updates.review_date !== undefined) { sets.push('review_date = ?'); params.push(updates.review_date); }
  if (updates.review_comment !== undefined) { sets.push('review_comment = ?'); params.push(updates.review_comment); }
  if (updates.review_history !== undefined) { sets.push('review_history = ?'); params.push(JSON.stringify(updates.review_history)); }

  params.push(slug);
  const result = db.prepare(`UPDATE docs SET ${sets.join(', ')} WHERE slug = ?`).run(...params);
  return result.changes > 0;
}

export function deleteDoc(slug: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM docs WHERE slug = ?').run(slug);
  return result.changes > 0;
}

/** 获取所有存储在 DB 中的 slug，用于引用检查 */
export function getAllDbSlugs(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT slug FROM docs').all() as { slug: string }[];
  return rows.map((r) => r.slug);
}
