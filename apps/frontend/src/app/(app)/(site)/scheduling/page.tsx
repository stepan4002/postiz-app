'use client';

import React, { useState } from 'react';
import { useCompany } from '@gitroom/frontend/components/company-switcher/company-context';
import { SchedulingCalendar } from '@gitroom/frontend/components/scheduling/scheduling-calendar';
import { SchedulePostForm } from '@gitroom/frontend/components/scheduling/schedule-post-form';
import { FailedPostsPanel } from '@gitroom/frontend/components/scheduling/failed-posts-panel';
import { ScheduledPost } from '@gitroom/frontend/components/scheduling/use-scheduled-posts';
import { useScheduledPosts } from '@gitroom/frontend/components/scheduling/use-scheduled-posts';

/**
 * SchedulingPage
 *
 * Route: /scheduling
 * Layout: Calendar (top, 2/3), Failed Posts Panel (bottom, 1/3)
 * Provides scheduling calendar with day/week views and failed posts visibility.
 */

// Inner component needs SWR context from parent
function SchedulingPageInner() {
  const { companySlug } = useCompany();
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [calendarKey, setCalendarKey] = useState(0);

  const handlePostScheduled = () => {
    // Force calendar refresh by changing key
    setCalendarKey((k) => k + 1);
  };

  if (!companySlug) {
    return (
      <div className="flex items-center justify-center h-64 text-textItemBlur text-sm">
        Please select a company to view the scheduling calendar.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-textColor">Scheduling</h1>
        <p className="text-sm text-textItemBlur">
          View and manage scheduled posts across all platforms
        </p>
      </div>

      {/* Calendar — 2/3 height */}
      <div className="flex-[2] min-h-0">
        <SchedulingCalendar
          key={calendarKey}
          companySlug={companySlug}
          onSchedulePost={setSelectedPost}
        />
      </div>

      {/* Failed posts panel — 1/3 height */}
      <div className="flex-[1] min-h-0 overflow-auto">
        <FailedPostsPanel companySlug={companySlug} />
      </div>

      {/* Schedule form modal */}
      {selectedPost && (
        <SchedulePostForm
          post={selectedPost}
          companySlug={companySlug}
          onClose={() => setSelectedPost(null)}
          onScheduled={handlePostScheduled}
        />
      )}
    </div>
  );
}

export default function SchedulingPage() {
  return <SchedulingPageInner />;
}
