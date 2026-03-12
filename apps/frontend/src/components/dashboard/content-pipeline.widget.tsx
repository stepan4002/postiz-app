'use client';
import { FC } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCompany } from '@gitroom/frontend/components/company-switcher/company-context';

interface PipelineData {
  drafts: number;
  inReview: number;
  scheduled: number;
  published: number;
}

const usePipelineData = () => {
  const fetch = useFetch();
  const { companySlug } = useCompany();
  return useSWR<PipelineData>(
    companySlug ? `/companies/${companySlug}/dashboard/pipeline` : null,
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};

export const ContentPipelineWidget: FC = () => {
  const { data } = usePipelineData();
  const stages = [
    { label: 'Drafts', count: data?.drafts || 0, color: 'bg-gray-500' },
    {
      label: 'In Review',
      count: data?.inReview || 0,
      color: 'bg-yellow-500',
    },
    {
      label: 'Scheduled',
      count: data?.scheduled || 0,
      color: 'bg-blue-500',
    },
    {
      label: 'Published',
      count: data?.published || 0,
      color: 'bg-green-500',
    },
  ];

  const total = stages.reduce((s, st) => s + st.count, 0) || 1;

  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--newBgColorInner)' }}>
      <h3 className="text-[var(--textColor)] font-medium mb-3">
        Content Pipeline
      </h3>
      <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
        {stages.map((stage) => (
          <div
            key={stage.label}
            className={`${stage.color}`}
            style={{
              width: `${(stage.count / total) * 100}%`,
              minWidth: stage.count > 0 ? '4px' : '0',
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {stages.map((stage) => (
          <div key={stage.label}>
            <div className="text-[var(--textColor)] font-bold">
              {stage.count}
            </div>
            <div className="text-[var(--textItemBlur)] text-xs">
              {stage.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
