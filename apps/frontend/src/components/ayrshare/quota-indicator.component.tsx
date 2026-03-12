'use client';

import { FC } from 'react';
import { useAyrShareQuota } from './hooks/use-ayrshare-quota';

export const AyrShareQuotaIndicator: FC = () => {
  const { data: quota, isLoading } = useAyrShareQuota();

  if (isLoading || !quota) return null;

  const percentage = Math.round((quota.used / quota.max) * 100);
  const isNearLimit = percentage >= 80;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-inputText">Profile quota:</span>
      <div className="flex-1 max-w-[200px] h-2 bg-fifth rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isNearLimit ? 'bg-yellow-500' : 'bg-primary'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className={`text-xs ${isNearLimit ? 'text-yellow-400' : 'text-inputText'}`}>
        {quota.used} / {quota.max}
      </span>
    </div>
  );
};
