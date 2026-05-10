import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getDoc } from '../../lib/index';
import { ReviewButton } from './review-button.view';

interface Props {
  params: Promise<{ slug: string[] }>;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  reviewed: { label: '已审核', className: 'bg-green-50 text-green-700 border-green-200' },
  published: { label: '已发布', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  rejected: { label: '已驳回', className: 'bg-red-50 text-red-700 border-red-200' },
};

const ACTION_LABELS: Record<string, string> = {
  approved: '通过审核',
  rejected: '驳回',
  published: '正式发布',
  unpublished: '退回草稿',
};

// 读取重定向表（与 try/catch 隔离，防止 redirect() 错误被吞）
async function getRedirects(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(join(process.cwd(), 'docs', 'data', '_redirects.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function DocDetailPage({ params }: Props) {
  const { slug } = await params;
  const docSlug = slug.join('/');

  // 提前读取重定向表（独立于后续逻辑，避免 redirect() 错误被 try/catch 吞掉）
  const redirects = await getRedirects();

  // 精确匹配重定向
  if (redirects[docSlug]) {
    redirect(`/docs/${redirects[docSlug]}`);
  }

  // 前缀匹配重定向（子路径）
  for (const [oldSlug, newSlug] of Object.entries(redirects)) {
    if (docSlug.startsWith(oldSlug + '/')) {
      redirect(`/docs/${docSlug.replace(oldSlug, newSlug)}`);
    }
  }

  const result = await getDoc(docSlug);

  if (!result) notFound();

  const { entry, content } = result;
  const fm = entry.frontmatter;
  const status = STATUS_CONFIG[fm.status] ?? STATUS_CONFIG.draft;
  const isRejected = fm.status === 'rejected';
  const hasHistory = fm.review_history && fm.review_history.length > 0;

  return (
    <div>
      {/* 顶部文档信息栏 */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href="/docs" className="hover:text-blue-600 transition-colors">文档</Link>
          <span>/</span>
          <span className="text-gray-600">{entry.title}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isRejected && <span className="text-red-500 mr-1">[驳回]</span>}
              {entry.title}
            </h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${status.className}`}>
                  {status.label}
                </span>
              </span>
              <span>负责人: <strong className="text-gray-700">{fm.author}</strong></span>
              <span>审核人: <strong className="text-gray-700">{fm.reviewer || '待审核'}</strong></span>
              {fm.review_date && <span>审核日: {fm.review_date}</span>}
              <span>复审日: {fm.last_reviewed}</span>
              {entry.isStale && (
                <span className="text-red-600 font-semibold">已过期，需复审</span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <ReviewButton slug={docSlug} currentStatus={fm.status} />
          </div>
        </div>
      </div>

      {/* 驳回理由 */}
      {isRejected && fm.review_comment && (
        <div className="mx-8 mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-1">驳回理由</h3>
          <p className="text-sm text-red-600">{fm.review_comment}</p>
        </div>
      )}

      {/* 审核历史 */}
      {hasHistory && (
        <div className="mx-8 mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <h3 className="text-sm font-semibold text-gray-700 px-4 py-3 bg-gray-50 border-b border-gray-200">
            审核记录
          </h3>
          <div className="divide-y divide-gray-100">
            {fm.review_history.map((record, idx) => (
              <div key={idx} className="px-4 py-2.5 flex items-start gap-4 text-sm">
                <span className="text-xs text-gray-400 w-20 shrink-0">{record.date}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  record.action === 'rejected'
                    ? 'bg-red-100 text-red-700'
                    : record.action === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : record.action === 'published'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                }`}>
                  {ACTION_LABELS[record.action] ?? record.action}
                </span>
                <span className="text-gray-500">审核人: {record.reviewer}</span>
                {record.comment && (
                  <span className="text-gray-600 italic">&ldquo;{record.comment}&rdquo;</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文档正文 */}
      <div className="px-8 py-8">
        <article className={`bg-white rounded-lg border p-10 max-w-none ${
          isRejected ? 'border-red-300 opacity-75' : 'border-gray-200'
        }`}>
          <div className="md-content">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        </article>
      </div>
    </div>
  );
}
