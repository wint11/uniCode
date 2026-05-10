'use client';

import { useState } from 'react';
import { batchApproveDocs } from '../../lib/actions';
import type { DocEntry } from '../../lib/types';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  reviewed: { label: '已审核', className: 'bg-green-50 text-green-700 border-green-200' },
  published: { label: '已发布', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  rejected: { label: '已驳回', className: 'bg-red-50 text-red-700 border-red-200' },
};

interface Props {
  docs: DocEntry[];
}

export function BatchApproveBar({ docs }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const allSelected = docs.length > 0 && selected.size === docs.length;

  const toggle = (slug: string) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelected(next);
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(docs.map((d) => d.slug)));
  };

  const handleBatchApprove = async () => {
    if (selected.size === 0) return;
    setIsLoading(true);
    setMessage('');
    try {
      const slugs = Array.from(selected);
      const result = await batchApproveDocs(slugs);
      setMessage(result.success ? `已通过 ${slugs.length} 篇` : result.error || '操作失败');
      if (result.success) {
        setSelected(new Set());
        window.location.reload();
      }
    } catch {
      setMessage('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  if (docs.length === 0) {
    return (
      <div className="px-8 py-12 text-center text-sm text-gray-400 italic">
        暂无草稿，运行 <code className="bg-gray-100 px-1 rounded">npm run seed -- --reset</code> 生成
      </div>
    );
  }

  return (
    <div className="px-8 py-4">
      {/* 批量操作栏 */}
      <div className="flex items-center gap-4 mb-3">
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          全选
        </label>
        <span className="text-xs text-gray-400">{selected.size} 篇已选</span>
        <button
          onClick={handleBatchApprove}
          disabled={selected.size === 0 || isLoading}
          className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? '处理中...' : `批量通过 (${selected.size})`}
        </button>
        {message && (
          <span className={`text-xs ${message.includes('成功') || message.includes('已通过') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </span>
        )}
      </div>

      {/* 草稿表格 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">文档标题</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs w-48">负责人</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {docs.map((doc) => {
              const status = STATUS_CONFIG[doc.frontmatter.status] ?? STATUS_CONFIG.draft;
              return (
                <tr key={doc.slug} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(doc.slug)}
                      onChange={() => toggle(doc.slug)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2 max-w-xs">
                    <a href={`/docs/${doc.slug}`} className="block">
                      <span className="font-medium text-gray-900 hover:text-blue-600 transition-colors truncate block">
                        {doc.title}
                      </span>
                      <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{doc.slug}</p>
                    </a>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{doc.frontmatter.author}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
