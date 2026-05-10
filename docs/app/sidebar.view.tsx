'use client';

import { useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { TreeNode } from './layout';

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-yellow-400',
  reviewed: 'bg-green-400',
  published: 'bg-blue-400',
  rejected: 'bg-red-400',
};

interface Props {
  publishedTree: TreeNode[];
  draftTree: TreeNode[];
  publishedCount: number;
  draftCount: number;
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query.trim()) return nodes;
  const lower = query.toLowerCase();
  function nodeMatches(n: TreeNode): boolean {
    if (n.label.toLowerCase().includes(lower)) return true;
    if (n.slug.toLowerCase().includes(lower)) return true;
    return false;
  }
  function filter(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];
    for (const n of nodes) {
      const children = filter(n.children);
      if (nodeMatches(n) || children.length > 0) result.push({ ...n, children });
    }
    return result;
  }
  return filter(nodes);
}

export function DocSidebar({ publishedTree, draftTree, publishedCount, draftCount }: Props) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const isDrafts = pathname.startsWith('/docs/drafts');

  const filteredPublished = useMemo(() => filterTree(publishedTree, search), [publishedTree, search]);
  const filteredDrafts = useMemo(() => filterTree(draftTree, search), [draftTree, search]);

  const tree = isDrafts ? filteredDrafts : filteredPublished;
  const count = isDrafts ? draftCount : publishedCount;
  const label = isDrafts ? '草稿区' : '正式文档';

  return (
    <nav className="flex-1 flex flex-col overflow-hidden">
      <NavLinks />
      <div className="px-3 py-2.5">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文档..."
            className="w-full bg-gray-800 text-gray-200 text-xs rounded-md pl-8 pr-2 py-1.5
                       border border-gray-700 focus:border-gray-500 focus:outline-none
                       placeholder-gray-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest shrink-0">
        {label} ({count})
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {tree.length > 0 ? (
          <TreeNodes nodes={tree} depth={0} />
        ) : (
          <p className="px-5 py-2 text-xs text-gray-600 italic">
            {search ? '无匹配结果' : '暂无文档'}
          </p>
        )}
      </div>
    </nav>
  );
}

function NavLinks() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="px-2 py-1.5 flex gap-1">
      <button
        onClick={() => router.push('/docs')}
        className={`flex-1 text-[11px] font-medium rounded px-2 py-1.5 transition-colors ${
          pathname === '/docs'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
        }`}
      >
        正式文档
      </button>
      <button
        onClick={() => router.push('/docs/drafts')}
        className={`flex-1 text-[11px] font-medium rounded px-2 py-1.5 transition-colors ${
          pathname.startsWith('/docs/drafts')
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
        }`}
      >
        草稿区
      </button>
    </div>
  );
}

function TreeNodes({ nodes, depth }: { nodes: TreeNode[]; depth: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentSlug = pathname.replace('/docs/', '').replace(/^\/docs$/, '');

  return (
    <>
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          depth={depth}
          currentSlug={currentSlug}
          router={router}
        />
      ))}
    </>
  );
}

function TreeNodeItem({
  node, depth, currentSlug, router,
}: {
  node: TreeNode; depth: number; currentSlug: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (!node.isDir) {
    const isActive = currentSlug === node.slug;
    return (
      <button
        onClick={() => router.push(`/docs/${node.slug}`)}
        className={`w-full text-left text-sm transition-colors truncate flex items-center gap-1.5 ${
          isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
        }`}
        style={{ paddingLeft: `${12 + depth * 14}px`, paddingRight: '10px', paddingTop: '4px', paddingBottom: '4px' }}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${(node.doc && STATUS_DOT[node.doc.frontmatter.status]) || 'bg-gray-500'}`} />
        <span className="truncate">{node.label}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center gap-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
      >
        <svg className={`w-2.5 h-2.5 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
        {node.label}
      </button>
      {isOpen && node.children.length > 0 && <TreeNodes nodes={node.children} depth={depth + 1} />}
    </div>
  );
}
