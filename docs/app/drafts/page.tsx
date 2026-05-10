import { getAllDocs } from '../../lib/index';
import { getRejectedDocs } from '../../lib/actions';
import { BatchApproveBar } from './batch-approve.view';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  reviewed: { label: '已审核', className: 'bg-green-50 text-green-700 border-green-200' },
  published: { label: '已发布', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  rejected: { label: '已驳回', className: 'bg-red-50 text-red-700 border-red-200' },
};

export default async function DraftsPage() {
  const allDocs = await getAllDocs();
  const rejectedList = await getRejectedDocs();
  const draftDocs = allDocs.filter((d) => d.relativePath.replace(/\\/g, '/').startsWith('drafts/'));

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">草稿区</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {draftDocs.length} 篇草稿 · 通过审核后自动发布到正式目录
            </p>
          </div>
        </div>
      </div>

      {/* 驳回列表 */}
      {rejectedList.length > 0 && (
        <div className="px-8 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-700 mb-2">
              已驳回 ({rejectedList.length})
            </h3>
            <div className="space-y-1">
              {rejectedList.map((item) => (
                <a
                  key={item.slug}
                  href={`/docs/${item.slug}`}
                  className="flex items-center justify-between bg-white rounded border border-red-100 px-3 py-1.5 text-sm hover:shadow-sm"
                >
                  <span className="font-medium text-gray-900">{item.title}</span>
                  <span className="text-xs text-red-500">{item.reason}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 草稿列表 + 批量操作 */}
      <BatchApproveBar docs={draftDocs} />
    </div>
  );
}
