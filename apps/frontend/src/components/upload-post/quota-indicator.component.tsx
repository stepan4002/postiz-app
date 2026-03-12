'use client';

import { FC } from 'react';
import { useUploadPostQuota } from './hooks/use-upload-post-quota';

export const QuotaIndicator: FC = () => {
  const { data: quota, isLoading } = useUploadPostQuota();

  if (isLoading || !quota) {
    return null;
  }

  const percentage = quota.max > 0 ? (quota.used / quota.max) * 100 : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-[120px]">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-inputText">
            {quota.used} / {quota.max} profiles
          </span>
          <span className="text-inputText capitalize">
            {quota.planType}
          </span>
        </div>
        <div className="w-full bg-fifth rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit
                ? 'bg-red-500'
                : isNearLimit
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
      {quota.remaining > 0 && (
        <span className="text-xs text-inputText">
          {quota.remaining} remaining
        </span>
      )}
    </div>
  );
};
