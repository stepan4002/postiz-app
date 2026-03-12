'use client';
import { FC } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCompany } from '@gitroom/frontend/components/company-switcher/company-context';

interface AttentionItem {
  type: 'failed_post' | 'content_gap' | 'stale_draft' | 'unread_inbox';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  link?: string;
}

const useAttentionItems = () => {
  const fetch = useFetch();
  const { companySlug } = useCompany();
  return useSWR<{ items: AttentionItem[] }>(
    companySlug ? `/companies/${companySlug}/dashboard/attention` : null,
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};

export const AttentionNeededWidget: FC = () => {
  const { data } = useAttentionItems();
  const items = data?.items || [];

  const severityStyles: Record<string, string> = {
    high: 'border-l-red-500 bg-red-500/5',
    medium: 'border-l-yellow-500 bg-yellow-500/5',
    low: 'border-l-blue-500 bg-blue-500/5',
  };

  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--newBgColorInner)' }}>
      <h3 className="text-[var(--textColor)] font-medium mb-3">Needs Attention</h3>
      {items.length === 0 ? (
        <p className="text-[var(--textItemBlur)] text-sm">
          All clear! Nothing needs your attention.
        </p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item, i) => (
            <div
              key={i}
              className={`p-2 rounded border-l-2 ${severityStyles[item.severity] || severityStyles.low}`}
            >
              <div className="text-[var(--textColor)] text-sm font-medium">
                {item.title}
              </div>
              <div className="text-[var(--textItemBlur)] text-xs">
                {item.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
