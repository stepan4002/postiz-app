'use client';
import { FC, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCompany } from '@gitroom/frontend/components/company-switcher/company-context';

interface ReportSummary {
  id: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  data: {
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalImpressions: number;
    totalEngagement: number;
    platformBreakdown: Record<
      string,
      { posts: number; engagement: number }
    >;
    topPerformers: Array<{
      postId: string;
      title: string;
      engagement: number;
    }>;
  };
  aiSummary?: string;
  createdAt: string;
}

const useReports = (type?: string) => {
  const fetch = useFetch();
  const { companySlug } = useCompany();
  const params = type ? `?type=${type}` : '';
  return useSWR<{ items: ReportSummary[]; total: number }>(
    companySlug ? `/companies/${companySlug}/reports${params}` : null,
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};

export const ReportsComponent: FC = () => {
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [selectedReport, setSelectedReport] =
    useState<ReportSummary | null>(null);
  const { data, isLoading } = useReports(typeFilter);

  const formatDate = (date: string) => new Date(date).toLocaleDateString();
  const formatNumber = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--textColor)]">
            Reports
          </h1>
          <p className="text-[var(--textItemBlur)] mt-1">
            Weekly and monthly performance summaries
          </p>
        </div>
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 mb-6">
        {[undefined, 'weekly', 'monthly'].map((t) => (
          <button
            key={t || 'all'}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              typeFilter === t ? 'text-white' : 'text-[var(--textItemBlur)]'
            }`}
            style={
              typeFilter === t
                ? { background: 'var(--btnPrimary)' }
                : { background: 'var(--interactiveElementBg)' }
            }
          >
            {t ? t.charAt(0).toUpperCase() + t.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-[var(--textItemBlur)]">Loading reports...</div>
      ) : selectedReport ? (
        <ReportDetail
          report={selectedReport}
          onBack={() => setSelectedReport(null)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.items?.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="p-4 rounded-lg cursor-pointer hover:ring-2 ring-blue-500 transition-all"
              style={{ background: 'var(--newBgColorInner)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    report.type === 'weekly'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}
                >
                  {report.type}
                </span>
                <span className="text-[var(--textItemBlur)] text-xs">
                  {formatDate(report.periodStart)} &mdash;{' '}
                  {formatDate(report.periodEnd)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[var(--textColor)] font-bold">
                    {formatNumber(report.data?.totalPosts || 0)}
                  </div>
                  <div className="text-[var(--textItemBlur)] text-xs">
                    Posts
                  </div>
                </div>
                <div>
                  <div className="text-[var(--textColor)] font-bold">
                    {formatNumber(report.data?.totalEngagement || 0)}
                  </div>
                  <div className="text-[var(--textItemBlur)] text-xs">
                    Engagement
                  </div>
                </div>
                <div>
                  <div className="text-[var(--textColor)] font-bold">
                    {formatNumber(report.data?.totalImpressions || 0)}
                  </div>
                  <div className="text-[var(--textItemBlur)] text-xs">
                    Impressions
                  </div>
                </div>
              </div>
            </div>
          ))}
          {(!data?.items || data.items.length === 0) && (
            <div className="col-span-3 text-center py-12 text-[var(--textItemBlur)]">
              <p className="text-lg">No reports yet</p>
              <p className="text-sm mt-1">
                Reports are generated automatically every week and month
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ReportDetail: FC<{
  report: ReportSummary;
  onBack: () => void;
}> = ({ report, onBack }) => {
  const formatNumber = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();
  const d = report.data || ({} as any);

  return (
    <div>
      <button
        onClick={onBack}
        className="text-[var(--textItemBlur)] text-sm mb-4 hover:text-[var(--textColor)]"
      >
        &larr; Back to reports
      </button>
      <div
        className="p-6 rounded-lg mb-6"
        style={{ background: 'var(--newBgColorInner)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--textColor)] capitalize">
            {report.type} Report
          </h2>
          <span className="text-[var(--textItemBlur)]">
            {new Date(report.periodStart).toLocaleDateString()} &mdash;{' '}
            {new Date(report.periodEnd).toLocaleDateString()}
          </span>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Posts', value: d.totalPosts || 0 },
            { label: 'Likes', value: d.totalLikes || 0 },
            { label: 'Comments', value: d.totalComments || 0 },
            { label: 'Shares', value: d.totalShares || 0 },
            { label: 'Impressions', value: d.totalImpressions || 0 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center p-3 rounded-lg"
              style={{ background: 'var(--interactiveElementBg)' }}
            >
              <div className="text-[var(--textColor)] text-2xl font-bold">
                {formatNumber(stat.value)}
              </div>
              <div className="text-[var(--textItemBlur)] text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Platform Breakdown */}
        {d.platformBreakdown &&
          Object.keys(d.platformBreakdown).length > 0 && (
            <div className="mb-6">
              <h3 className="text-[var(--textColor)] font-medium mb-3">
                Platform Breakdown
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(d.platformBreakdown).map(
                  ([platform, stats]: [string, any]) => (
                    <div
                      key={platform}
                      className="p-3 rounded-lg"
                      style={{ background: 'var(--interactiveElementBg)' }}
                    >
                      <div className="text-[var(--textColor)] font-medium capitalize">
                        {platform}
                      </div>
                      <div className="text-[var(--textItemBlur)] text-sm">
                        {stats.posts} posts &middot;{' '}
                        {formatNumber(stats.engagement)} engagement
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

        {/* Top Performers */}
        {d.topPerformers && d.topPerformers.length > 0 && (
          <div>
            <h3 className="text-[var(--textColor)] font-medium mb-3">
              Top Performers
            </h3>
            <div className="space-y-2">
              {d.topPerformers.map((post: any, i: number) => (
                <div
                  key={post.postId}
                  className="flex items-center justify-between p-2 rounded-lg"
                  style={{ background: 'var(--interactiveElementBg)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--textItemBlur)] font-mono text-sm">
                      #{i + 1}
                    </span>
                    <span className="text-[var(--textColor)] text-sm">
                      {post.title}
                    </span>
                  </div>
                  <span className="text-[var(--textColor)] font-medium">
                    {formatNumber(post.engagement)} eng.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Summary */}
        {report.aiSummary && (
          <div className="mt-6 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <h3 className="text-blue-400 font-medium mb-2">AI Summary</h3>
            <p className="text-[var(--textColor)] whitespace-pre-wrap">
              {report.aiSummary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
