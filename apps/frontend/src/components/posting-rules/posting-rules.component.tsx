'use client';
import { FC, useState, useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCompany } from '@gitroom/frontend/components/company-switcher/company-context';

interface PostingRule {
  id: string;
  name: string;
  platformId: string;
  frequency: number;
  timeSlots: Array<{ hour: number; minute: number }>;
  contentTypes: string[];
  hashtags: string[];
  enabled: boolean;
  createdAt: string;
}

const usePostingRules = () => {
  const fetch = useFetch();
  const { companySlug } = useCompany();
  return useSWR<{ items: PostingRule[]; total: number }>(
    companySlug ? `/companies/${companySlug}/posting-rules` : null,
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};

export const PostingRulesComponent: FC = () => {
  const { data, error, isLoading, mutate } = usePostingRules();
  const fetch = useFetch();
  const { companySlug } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<PostingRule | null>(null);

  const toggleRule = useCallback(
    async (ruleId: string, enabled: boolean) => {
      if (!companySlug) return;
      await fetch(`/companies/${companySlug}/posting-rules/${ruleId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      mutate();
    },
    [companySlug, fetch, mutate],
  );

  const deleteRule = useCallback(
    async (ruleId: string) => {
      if (!companySlug) return;
      await fetch(`/companies/${companySlug}/posting-rules/${ruleId}`, {
        method: 'DELETE',
      });
      mutate();
    },
    [companySlug, fetch, mutate],
  );

  if (isLoading)
    return (
      <div className="p-6 text-[var(--textColor)]">
        Loading posting rules...
      </div>
    );
  if (error)
    return <div className="p-6 text-red-400">Error loading posting rules</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--textColor)]">
            Posting Rules
          </h1>
          <p className="text-[var(--textItemBlur)] mt-1">
            Define automated posting schedules per platform
          </p>
        </div>
        <button
          onClick={() => {
            setEditingRule(null);
            setShowForm(true);
          }}
          className="px-4 py-2 rounded-lg text-white font-medium"
          style={{ background: 'var(--btnPrimary)' }}
        >
          + New Rule
        </button>
      </div>

      {showForm && (
        <RuleForm
          rule={editingRule}
          companyId={companySlug || ''}
          onClose={() => {
            setShowForm(false);
            setEditingRule(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingRule(null);
            mutate();
          }}
        />
      )}

      <div className="space-y-3">
        {data?.items?.map((rule) => (
          <div
            key={rule.id}
            className="p-4 rounded-lg flex items-center justify-between"
            style={{ background: 'var(--newBgColorInner)' }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-[var(--textColor)] font-medium">
                  {rule.name}
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                  {rule.platformId}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    rule.enabled
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {rule.enabled ? 'Active' : 'Paused'}
                </span>
              </div>
              <div className="text-[var(--textItemBlur)] text-sm mt-1">
                {rule.frequency}x/day &middot;{' '}
                {rule.timeSlots?.length || 0} time slots &middot;{' '}
                {rule.contentTypes?.join(', ') || 'All types'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleRule(rule.id, rule.enabled)}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: 'var(--interactiveElementBg)' }}
              >
                {rule.enabled ? 'Pause' : 'Enable'}
              </button>
              <button
                onClick={() => {
                  setEditingRule(rule);
                  setShowForm(true);
                }}
                className="px-3 py-1.5 rounded text-sm text-[var(--textColor)]"
                style={{ background: 'var(--interactiveElementBg)' }}
              >
                Edit
              </button>
              <button
                onClick={() => deleteRule(rule.id)}
                className="px-3 py-1.5 rounded text-sm text-red-400 hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {(!data?.items || data.items.length === 0) && (
          <div className="text-center py-12 text-[var(--textItemBlur)]">
            <p className="text-lg">No posting rules yet</p>
            <p className="text-sm mt-1">
              Create rules to automate your posting schedule
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const RuleForm: FC<{
  rule: PostingRule | null;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ rule, companyId, onClose, onSaved }) => {
  const fetch = useFetch();
  const [name, setName] = useState(rule?.name || '');
  const [platformId, setPlatformId] = useState(
    rule?.platformId || 'instagram',
  );
  const [frequency, setFrequency] = useState(rule?.frequency || 1);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = rule
        ? `/companies/${companyId}/posting-rules/${rule.id}`
        : `/companies/${companyId}/posting-rules`;
      await fetch(url, {
        method: rule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          platformId,
          frequency,
          timeSlots: [
            { hour: 9, minute: 0 },
            { hour: 17, minute: 0 },
          ],
          contentTypes: ['text', 'image'],
          hashtags: [],
        }),
      });
      onSaved();
    } catch (err) {
      console.error('Failed to save rule:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="mb-6 p-4 rounded-lg border border-[var(--interactiveElementBg)]"
      style={{ background: 'var(--newBgColorInner)' }}
    >
      <h3 className="text-lg font-medium text-[var(--textColor)] mb-4">
        {rule ? 'Edit Rule' : 'New Posting Rule'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--textItemBlur)] mb-1">
              Rule Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--interactiveElementBg)] text-[var(--textColor)] border-none outline-none"
              placeholder="e.g., Daily Instagram Posts"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--textItemBlur)] mb-1">
              Platform
            </label>
            <select
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--interactiveElementBg)] text-[var(--textColor)] border-none outline-none"
            >
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="x">X (Twitter)</option>
              <option value="linkedin">LinkedIn</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--textItemBlur)] mb-1">
              Posts per Day
            </label>
            <input
              type="number"
              value={frequency}
              onChange={(e) => setFrequency(parseInt(e.target.value))}
              min={1}
              max={20}
              className="w-full px-3 py-2 rounded-lg bg-[var(--interactiveElementBg)] text-[var(--textColor)] border-none outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[var(--textItemBlur)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-white font-medium"
            style={{ background: 'var(--btnPrimary)' }}
          >
            {saving ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </form>
    </div>
  );
};
