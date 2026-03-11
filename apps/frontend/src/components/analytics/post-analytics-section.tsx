'use client';

import React, { useState } from 'react';
import { PostAnalyticsPanel } from './post-analytics-panel';

/**
 * PostAnalyticsSection
 *
 * Client-side section for per-post analytics.
 * Provides a post ID input that triggers PostAnalyticsPanel to load metrics.
 *
 * Satisfies R11.4: Per-post analytics panel accessible at /analytics route with post selection input.
 */
export function PostAnalyticsSection() {
  const [inputValue, setInputValue] = useState('');
  const [selectedPostId, setSelectedPostId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedPostId(inputValue.trim());
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-xl font-semibold text-textColor">Post Analytics</h2>
        <p className="text-sm text-textItemBlur mt-1">
          Enter a post ID to view engagement metrics across 1h, 24h, and 7d snapshots.
        </p>
      </div>

      {/* Post ID input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter post ID to view analytics"
          className="flex-1 px-3 py-2 bg-input text-textColor border border-newTableBorder rounded-md text-sm placeholder:text-textItemBlur focus:outline-none focus:ring-1 focus:ring-forth"
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="px-4 py-2 bg-forth text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Load Analytics
        </button>
      </form>

      {/* Analytics panel */}
      {selectedPostId && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-medium text-textColor">
              Analytics for post:
            </h3>
            <code className="text-xs text-textItemBlur bg-newBgColorInner border border-newTableBorder rounded px-2 py-0.5">
              {selectedPostId}
            </code>
          </div>
          <PostAnalyticsPanel postId={selectedPostId} />
        </div>
      )}
    </div>
  );
}
