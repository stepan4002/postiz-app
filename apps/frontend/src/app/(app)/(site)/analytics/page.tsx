export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { PlatformAnalytics } from '@gitroom/frontend/components/platform-analytics/platform.analytics';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { PostAnalyticsSection } from '@gitroom/frontend/components/analytics/post-analytics-section';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Analytics`,
  description: '',
};

export default async function Index() {
  return (
    <div className="space-y-8">
      {/* Existing Postiz platform analytics */}
      <PlatformAnalytics />

      {/* Social Command Centre — Per-post analytics panel (R11.4) */}
      <PostAnalyticsSection />
    </div>
  );
}
