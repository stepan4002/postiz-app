'use client';
import { FC, useState, useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCompany } from '@gitroom/frontend/components/company-switcher/company-context';

interface InboxItem {
  id: string;
  platform: string;
  type: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
  sentiment?: string;
  status: string;
  receivedAt: string;
}

const useInbox = (status: string, platform?: string) => {
  const fetch = useFetch();
  const { companySlug } = useCompany();
  const params = new URLSearchParams({ status });
  if (platform) params.set('platform', platform);
  return useSWR<{ items: InboxItem[]; total: number }>(
    companySlug
      ? `/companies/${companySlug}/inbox?${params.toString()}`
      : null,
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};

const useUnreadCount = () => {
  const fetch = useFetch();
  const { companySlug } = useCompany();
  return useSWR<{ count: number }>(
    companySlug ? `/companies/${companySlug}/inbox/unread-count` : null,
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};

export const InboxComponent: FC = () => {
  const [statusFilter, setStatusFilter] = useState('unread');
  const [platformFilter, setPlatformFilter] = useState<string | undefined>(
    undefined,
  );
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const { data, isLoading, mutate } = useInbox(statusFilter, platformFilter);
  const { data: unreadData } = useUnreadCount();
  const fetch = useFetch();
  const { companySlug } = useCompany();

  const markRead = useCallback(
    async (itemId: string) => {
      if (!companySlug) return;
      await fetch(`/companies/${companySlug}/inbox/${itemId}/read`, {
        method: 'PUT',
      });
      mutate();
    },
    [companySlug, fetch, mutate],
  );

  const archive = useCallback(
    async (itemId: string) => {
      if (!companySlug) return;
      await fetch(`/companies/${companySlug}/inbox/${itemId}/archive`, {
        method: 'PUT',
      });
      mutate();
      if (selectedItem?.id === itemId) setSelectedItem(null);
    },
    [companySlug, fetch, mutate, selectedItem],
  );

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-400 bg-green-500/20';
      case 'negative':
        return 'text-red-400 bg-red-500/20';
      case 'urgent':
        return 'text-orange-400 bg-orange-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--textColor)]">Inbox</h1>
          <p className="text-[var(--textItemBlur)] mt-1">
            Monitor comments, mentions, and messages &middot;{' '}
            {unreadData?.count || 0} unread
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['unread', 'read', 'replied', 'archived'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              statusFilter === s
                ? 'text-white'
                : 'text-[var(--textItemBlur)]'
            }`}
            style={
              statusFilter === s
                ? { background: 'var(--btnPrimary)' }
                : { background: 'var(--interactiveElementBg)' }
            }
          >
            {s}
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={platformFilter || ''}
            onChange={(e) =>
              setPlatformFilter(e.target.value || undefined)
            }
            className="px-3 py-1.5 rounded-lg text-sm bg-[var(--interactiveElementBg)] text-[var(--textColor)] border-none outline-none"
          >
            <option value="">All Platforms</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="x">X (Twitter)</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-[var(--textItemBlur)]">Loading inbox...</div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Item List */}
          <div className="col-span-5 space-y-2 max-h-[70vh] overflow-y-auto">
            {data?.items?.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItem(item);
                  if (item.status === 'unread') markRead(item.id);
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedItem?.id === item.id ? 'ring-2 ring-blue-500' : ''
                } ${item.status === 'unread' ? 'border-l-2 border-blue-500' : ''}`}
                style={{ background: 'var(--newBgColorInner)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[var(--textColor)] font-medium text-sm">
                    {item.authorName || 'Unknown'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400">
                    {item.platform}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400">
                    {item.type}
                  </span>
                  {item.sentiment && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${getSentimentColor(item.sentiment)}`}
                    >
                      {item.sentiment}
                    </span>
                  )}
                </div>
                <p className="text-[var(--textItemBlur)] text-xs mt-1 line-clamp-2">
                  {item.content}
                </p>
                <span className="text-[var(--textItemBlur)] text-[10px] mt-1 block">
                  {new Date(item.receivedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {(!data?.items || data.items.length === 0) && (
              <div className="text-center py-8 text-[var(--textItemBlur)]">
                No items in {statusFilter}
              </div>
            )}
          </div>

          {/* Detail View */}
          <div className="col-span-7">
            {selectedItem ? (
              <div
                className="p-4 rounded-lg"
                style={{ background: 'var(--newBgColorInner)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--textColor)] font-medium">
                      {selectedItem.authorName || 'Unknown'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                      {selectedItem.platform}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => archive(selectedItem.id)}
                      className="px-3 py-1.5 rounded text-sm text-[var(--textItemBlur)]"
                      style={{ background: 'var(--interactiveElementBg)' }}
                    >
                      Archive
                    </button>
                  </div>
                </div>
                <div className="text-[var(--textColor)] whitespace-pre-wrap">
                  {selectedItem.content}
                </div>
                <div className="text-[var(--textItemBlur)] text-sm mt-4">
                  Received:{' '}
                  {new Date(selectedItem.receivedAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--textItemBlur)]">
                Select a message to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
