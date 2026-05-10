'use client';

import { useState } from 'react';
import {
  approveDoc,
  rejectDoc,
  unpublishDoc,
  resubmitDoc,
} from '../../lib/actions';

interface Props {
  slug: string;
  currentStatus: string;
}

export function ReviewButton({ slug, currentStatus }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [message, setMessage] = useState('');

  const handle = async (action: () => Promise<{ success: boolean; error?: string }>) => {
    setIsLoading(true);
    setMessage('');
    try {
      const result = await action();
      if (result.success) {
        setMessage('操作成功');
        window.location.reload();
      } else {
        setMessage(result.error || '操作失败');
      }
    } catch {
      setMessage('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {/* 通过审核并发布：草稿状态 → 直接发布到正式目录 */}
        {currentStatus === 'draft' && (
          <button
            onClick={() => handle(() => approveDoc(slug, ''))}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            通过审核
          </button>
        )}

        {/* 驳回：草稿状态 */}
        {currentStatus === 'draft' && (
          <button
            onClick={() => setShowReject(!showReject)}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            驳回
          </button>
        )}

        {/* 退回草稿：已发布状态 */}
        {currentStatus === 'published' && (
          <button
            onClick={() => handle(() => unpublishDoc(slug))}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            退回草稿
          </button>
        )}

        {/* 重新提交：驳回状态 */}
        {currentStatus === 'rejected' && (
          <button
            onClick={() => handle(() => resubmitDoc(slug))}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            修改完成，重新提交
          </button>
        )}
      </div>

      {/* 驳回理由输入框 */}
      {showReject && (
        <div className="w-72 bg-white border border-red-200 rounded-lg p-3 shadow-sm">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            rows={3}
            placeholder="请输入驳回理由..."
            required
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handle(() => rejectDoc(slug, rejectReason)).then(() => setShowReject(false))}
              disabled={isLoading || !rejectReason.trim()}
              className="flex-1 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              确认驳回
            </button>
            <button
              onClick={() => setShowReject(false)}
              className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-xs ${message.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      {isLoading && (
        <p className="text-xs text-gray-400">处理中...</p>
      )}
    </div>
  );
}
