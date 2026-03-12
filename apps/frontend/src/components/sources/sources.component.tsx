'use client';
import { FC, useState, useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCompany } from '@gitroom/frontend/components/company-switcher/company-context';

interface ContentSource {
  id: string;
  name: string;
  type: string;
  url?: string;
  enabled: boolean;
  lastFetchedAt?: string;
  createdAt: string;
  _count?: { items: number };
}

interface SourceItem {
  id: string;
  title: string;
  content: string;
  url?: string;
  imageUrl?: string;
  status: string;
  fetchedAt: string;
}

const useSources = () => {
  const fetch = useFetch();
  const { companySlug } = useCompany();
  return useSWR<{ items: ContentSource[]; total: number }>(
    companySlug ? `/companies/${companySlug}/sources` : null,
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};

const useSourceItems = (sourceId: string | null) => {
  const fetch = useFetch();
  const { companySlug } = useCompany();
  return useSWR<{ items: SourceItem[]; total: number }>(
    companySlug && sourceId
      ? `/companies/${companySlug}/sources/${sourceId}/items?status=new`
      : null,
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};

export const SourcesComponent: FC = () => {
  const { data, error, isLoading, mutate } = useSources();
  const fetch = useFetch();
  const { companySlug } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const { data: itemsData, mutate: mutateItems } =
    useSourceItems(selectedSource);

  const deleteSource = useCallback(
    async (sourceId: string) => {
      if (!companySlug) return;
      await fetch(`/companies/${companySlug}/sources/${sourceId}`, {
        method: 'DELETE',
      });
      if (selectedSource === sourceId) setSelectedSource(null);
      mutate();
    },
    [companySlug, fetch, mutate, selectedSource],
  );

  const useItem = useCallback(
    async (sourceId: string, itemId: string) => {
      if (!companySlug) return;
      await fetch(
        `/companies/${companySlug}/sources/${sourceId}/items/${itemId}/use`,
        { method: 'POST' },
      );
      mutateItems();
    },
    [companySlug, fetch, mutateItems],
  );

  if (isLoading)
    return (
      <div className="p-6 text-[var(--textColor)]">Loading sources...</div>
    );
  if (error)
    return <div className="p-6 text-red-400">Error loading sources</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--textColor)]">
            Content Sources
          </h1>
          <p className="text-[var(--textItemBlur)] mt-1">
            Import content from RSS feeds, blogs, and product pages
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg text-white font-medium"
          style={{ background: 'var(--btnPrimary)' }}
        >
          + Add Source
        </button>
      </div>

      {showForm && (
        <SourceForm
          companyId={companySlug || ''}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            mutate();
          }}
        />
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Sources List */}
        <div className="col-span-4 space-y-2">
          {data?.items?.map((source) => (
            <div
              key={source.id}
              onClick={() => setSelectedSource(source.id)}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedSource === source.id ? 'ring-2 ring-blue-500' : ''
              }`}
              style={{ background: 'var(--newBgColorInner)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[var(--textColor)] font-medium">
                  {source.name}
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                  {source.type}
                </span>
              </div>
              <div className="text-[var(--textItemBlur)] text-xs mt-1 truncate">
                {source.url || 'Manual'}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span
                  className={`text-xs ${
                    source.enabled ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {source.enabled ? 'Active' : 'Paused'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSource(source.id);
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {(!data?.items || data.items.length === 0) && (
            <div className="text-center py-8 text-[var(--textItemBlur)]">
              No sources yet
            </div>
          )}
        </div>

        {/* Source Items */}
        <div className="col-span-8">
          {selectedSource ? (
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-[var(--textColor)]">
                Fetched Items
              </h3>
              {itemsData?.items?.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg"
                  style={{ background: 'var(--newBgColorInner)' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-[var(--textColor)] font-medium">
                        {item.title}
                      </h4>
                      <p className="text-[var(--textItemBlur)] text-sm mt-1 line-clamp-2">
                        {item.content}
                      </p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 text-xs mt-1 block hover:underline"
                        >
                          {item.url}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => useItem(selectedSource, item.id)}
                      className="ml-3 px-3 py-1.5 rounded text-sm text-white font-medium shrink-0"
                      style={{ background: 'var(--btnPrimary)' }}
                    >
                      Use as Draft
                    </button>
                  </div>
                </div>
              ))}
              {(!itemsData?.items || itemsData.items.length === 0) && (
                <div className="text-center py-8 text-[var(--textItemBlur)]">
                  No new items from this source
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--textItemBlur)]">
              Select a source to view its items
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SourceForm: FC<{
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ companyId, onClose, onSaved }) => {
  const fetch = useFetch();
  const [name, setName] = useState('');
  const [type, setType] = useState('rss');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/companies/${companyId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, url, enabled: true }),
      });
      onSaved();
    } catch (err) {
      console.error('Failed to create source:', err);
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
        Add Content Source
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--textItemBlur)] mb-1">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--interactiveElementBg)] text-[var(--textColor)] border-none outline-none"
              placeholder="e.g., Company Blog"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--textItemBlur)] mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--interactiveElementBg)] text-[var(--textColor)] border-none outline-none"
            >
              <option value="rss">RSS Feed</option>
              <option value="blog">Blog URL</option>
              <option value="product">Product Page</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--textItemBlur)] mb-1">
              URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--interactiveElementBg)] text-[var(--textColor)] border-none outline-none"
              placeholder="https://..."
              required
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
            {saving ? 'Adding...' : 'Add Source'}
          </button>
        </div>
      </form>
    </div>
  );
};
