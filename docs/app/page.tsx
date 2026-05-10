import Link from 'next/link';
import { getAllDocs } from '../lib/index';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  reviewed: { label: '已审核', className: 'bg-green-50 text-green-700 border-green-200' },
  published: { label: '已发布', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  rejected: { label: '已驳回', className: 'bg-red-50 text-red-700 border-red-200' },
};

const DIR_LABELS: Record<string, string> = {
  'getting-started': '入门指南',
  'guides/development': '开发指南',
  'guides/testing': '测试指南',
  'guides/operations': '运维指南',
  'architecture/adr': '架构决策记录',
  'architecture/data-model': '数据模型',
  'apis': 'API 文档',
  'project-management': '项目管理',
};

export default async function DocsOverviewPage() {
  const allDocs = await getAllDocs();
  const publishedDocs = allDocs.filter((d) => !d.relativePath);
  const stale = publishedDocs.filter((d) => d.isStale);

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">正式文档</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {publishedDocs.length} 篇已发布
              {stale.length > 0 && <span className="text-red-500 ml-2">· {stale.length} 篇待复审</span>}
            </p>
          </div>
          <Link
            href="/docs/drafts"
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            草稿区 →
          </Link>
        </div>
      </div>

      <div className="px-8 py-4">
        {publishedDocs.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-12 text-center">
            暂无正式文档
            <div className="mt-2">
              <Link href="/docs/drafts" className="text-blue-500 hover:underline">前往草稿区</Link>
            </div>
          </div>
        ) : (
          <GroupedTable docs={publishedDocs} />
        )}
      </div>
    </div>
  );
}

function GroupedTable({ docs }: { docs: Awaited<ReturnType<typeof getAllDocs>> }) {
  const groups: Record<string, typeof docs> = {};
  for (const doc of docs) {
    const pathSrc = doc.slug;
    const dir = pathSrc.split('/').slice(0, -1).join('/') || '根目录';
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(doc);
  }

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([groupKey, groupDocs]) => (
        <section key={groupKey}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {DIR_LABELS[groupKey] ?? groupKey}
            <span className="ml-1.5 font-normal">({groupDocs.length})</span>
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs w-80 max-w-80">文档标题</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs w-20">负责人</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs w-16">复审</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupDocs.map((doc) => (
                  <tr key={doc.slug} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 max-w-80">
                      <a href={`/docs/${doc.slug}`} className="block">
                        <span className="font-medium text-gray-900 hover:text-blue-600 transition-colors truncate block">
                          {doc.title}
                        </span>
                        <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{doc.slug}</p>
                      </a>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{doc.frontmatter.author}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {doc.isStale ? <span className="text-red-500">过期</span> : doc.frontmatter.last_reviewed || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
