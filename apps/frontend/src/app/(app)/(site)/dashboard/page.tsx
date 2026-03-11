'use client';

import { DashboardPage } from '@gitroom/frontend/components/dashboard/dashboard-page';

/**
 * Dashboard route page — /dashboard
 *
 * Command Centre landing page with 4 operator widgets:
 * - Today's scheduled posts
 * - Posts pending human review
 * - Publish failures (FAILED + STALE)
 * - Top performers (last 7 days by engagement)
 *
 * All data served from pre-computed DashboardCache (R12.5, NF3.1).
 * Company-scoped via ?c={slug} URL param (R12.6).
 */
export default function Dashboard() {
  return <DashboardPage />;
}
