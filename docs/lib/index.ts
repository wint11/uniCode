import { cache } from 'react';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import matter from 'gray-matter';
import type { DocEntry, DocFrontMatter } from './types';
import { getAllDbDocs, getDbDoc } from './db/docs';

const DOCS_DIR = join(process.cwd(), 'docs');

async function findMdFiles(dir: string, baseDir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    if (entry.name === 'production' || entry.name === 'archive') continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findMdFiles(fullPath, baseDir));
    } else if (extname(entry.name) === '.md') {
      results.push(relative(baseDir, fullPath).replace(/\\/g, '/'));
    }
  }

  return results;
}

function extractTitle(filePath: string, content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1];
  return filePath.split('/').pop()?.replace(/\.md$/, '') ?? filePath;
}

function toStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'string') return v;
  return String(v ?? '');
}

function toSlug(filePath: string): string {
  return filePath.replace(/\.md$/, '').replace(/\\/g, '/');
}

async function readFileSystemDocs(): Promise<DocEntry[]> {
  const files = await findMdFiles(DOCS_DIR, DOCS_DIR);
  const entries: DocEntry[] = [];

  for (const file of files) {
    const fullPath = join(DOCS_DIR, file);
    const raw = await readFile(fullPath, 'utf-8');
    const parsed = matter(raw);
    const fm = parsed.data as Partial<DocFrontMatter>;
    const title = extractTitle(file, parsed.content);

    const frontmatter: DocFrontMatter = {
      author: toStr(fm.author),
      reviewer: toStr(fm.reviewer),
      status: (toStr(fm.status) as DocFrontMatter['status']) || 'draft',
      last_reviewed: toStr(fm.last_reviewed),
      review_date: toStr(fm.review_date),
      review_comment: toStr(fm.review_comment),
      review_history: Array.isArray(fm.review_history) ? (fm.review_history as DocFrontMatter['review_history']) : [],
      target_path: toStr(fm.target_path),
    };

    const reviewedDate = new Date(frontmatter.last_reviewed);
    const daysAgo = isNaN(reviewedDate.getTime())
      ? Infinity
      : (Date.now() - reviewedDate.getTime()) / (1000 * 60 * 60 * 24);

    entries.push({
      slug: toSlug(file),
      relativePath: file,
      frontmatter,
      title,
      isStale: daysAgo > 90,
    });
  }

  return entries;
}

// 合并文件系统（drafts）和数据库（正式文档）的文档列表
export const getAllDocs = cache(async (): Promise<DocEntry[]> => {
  const [fileDocs, dbDocs] = await Promise.all([
    readFileSystemDocs(),
    Promise.resolve(getAllDbDocs()),
  ]);

  // 合并，文件系统优先（同名 slug 以文件系统为准）
  const dbSlugs = new Set(dbDocs.map((d) => d.slug));
  const merged = [...dbDocs];

  for (const fd of fileDocs) {
    if (!dbSlugs.has(fd.slug)) {
      merged.push(fd);
    }
  }

  return merged.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
});

export const getDoc = cache(async (slug: string): Promise<{ entry: DocEntry; content: string } | null> => {
  // 先查 DB
  const dbDoc = getDbDoc(slug);
  if (dbDoc) {
    return { entry: dbDoc, content: dbDoc.content };
  }

  // 再查文件系统
  const allFileDocs = await readFileSystemDocs();
  const entry = allFileDocs.find((d) => d.slug === slug);
  if (!entry) return null;

  const fullPath = join(DOCS_DIR, entry.relativePath);
  const raw = await readFile(fullPath, 'utf-8');
  const parsed = matter(raw);

  return { entry, content: parsed.content };
});
