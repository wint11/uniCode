import Link from 'next/link';
import { getAllDocs } from '../lib/index';
import type { DocEntry } from '../lib/types';
import { DocSidebar } from './sidebar.view';
import { LogoutButton } from './logout-button.view';

export interface TreeNode {
  name: string;
  label: string;
  path: string;
  slug: string;
  children: TreeNode[];
  isDir: boolean;
  doc?: DocEntry;
}

const DIR_LABELS: Record<string, string> = {
  'getting-started': '入门指南',
  'guides': '开发指南',
  'development': '开发规范',
  'testing': '测试',
  'operations': '运维',
  'architecture': '架构设计',
  'adr': '架构决策记录',
  'data-model': '数据模型',
  'apis': 'API 文档',
  'project-management': '项目管理',
  'archive': '历史归档',
};

function buildTree(docs: DocEntry[], stripPrefix: string): TreeNode[] {
  const root: TreeNode[] = [];

  for (const doc of docs) {
    // DB 文档用 slug 构建树，文件系统文档用 relativePath
    const pathSrc = doc.relativePath || (doc.slug + '.md');
    const stripped = stripPrefix ? pathSrc.replace(new RegExp(`^${stripPrefix}/?`), '') : pathSrc;
    const parts = stripped.replace(/\.md$/, '').split('/');
    let level = root;
    let accumulatedPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      accumulatedPath += (accumulatedPath ? '/' : '') + part;

      let node = level.find((n) => n.name === part);
      if (!node) {
        node = {
          name: part,
          label: DIR_LABELS[part] ?? part,
          path: accumulatedPath,
          slug: isLast ? doc.slug : '',
          children: [],
          isDir: !isLast,
          doc: isLast ? doc : undefined,
        };
        level.push(node);
      }

      if (isLast) {
        node.doc = doc;
        node.slug = doc.slug;
        node.isDir = false;
      }

      level = node.children;
    }
  }

  return root;
}

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const allDocs = await getAllDocs();
  // 正式文档 = 数据库中已发布的文档
  const publishedDocs = allDocs.filter((d) => !d.relativePath);
  // 草稿区 = docs/drafts/ 目录下的文件
  const draftDocs = allDocs.filter((d) => d.relativePath.replace(/\\/g, '/').startsWith('drafts/'));

  const publishedTree = buildTree(publishedDocs, '');
  const draftTree = buildTree(draftDocs, 'drafts');

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <aside className="w-64 bg-gray-900 text-gray-200 flex flex-col shrink-0 overflow-hidden">
        <div className="p-5 border-b border-gray-700">
          <Link href="/docs" className="text-lg font-bold text-white tracking-wide">
            知识库
          </Link>
          <p className="text-xs text-gray-400 mt-1">文档管理系统</p>
        </div>

        <DocSidebar
          publishedTree={publishedTree}
          draftTree={draftTree}
          publishedCount={publishedDocs.length}
          draftCount={draftDocs.length}
        />

        <div className="p-4 border-t border-gray-700 text-xs text-gray-500 flex items-center justify-between">
          <Link href="/" className="hover:text-gray-300 transition-colors">&larr; 返回首页</Link>
          <LogoutButton />
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
