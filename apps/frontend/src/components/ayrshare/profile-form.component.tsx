'use client';

import { FC, useState, useCallback, useEffect } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { AyrShareProfileData } from './hooks/use-ayrshare-profiles';
import useSWR from 'swr';

interface Props {
  profile?: AyrShareProfileData;
  onClose: () => void;
  onSaved: () => void;
}

interface CompanyItem {
  id: string;
  name: string;
  slug: string;
  brands?: Array<{ id: string; name: string }>;
}

export const AyrShareProfileForm: FC<Props> = ({ profile, onClose, onSaved }) => {
  const fetch = useFetch();
  const toaster = useToaster();

  const { data: companies } = useSWR<CompanyItem[]>(
    'companies-list-for-ayrshare',
    () => fetch('/companies').then((r: any) => r.json()),
  );

  const [companyId, setCompanyId] = useState(profile?.company?.id || '');
  const [brandId, setBrandId] = useState(profile?.brand?.id || '');
  const [title, setTitle] = useState(profile?.title || '');
  const [languageCode, setLanguageCode] = useState(profile?.languageCode || 'en');
  const [languageName, setLanguageName] = useState(profile?.languageName || 'English');
  const [saving, setSaving] = useState(false);

  const selectedCompany = companies?.find((c) => c.id === companyId);

  useEffect(() => {
    if (!companyId && companies?.length) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'cs', name: 'Czech' },
    { code: 'sk', name: 'Slovak' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'it', name: 'Italian' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt', name: 'Portuguese' },
  ];

  const handleSubmit = useCallback(async () => {
    if (!companyId) {
      toaster.show('Please select a company', 'warning');
      return;
    }
    if (!title.trim()) {
      toaster.show('Please enter a profile title', 'warning');
      return;
    }

    setSaving(true);
    try {
      const url = profile
        ? `/ayrshare/profiles/${profile.id}`
        : '/ayrshare/profiles';
      const method = profile ? 'PUT' : 'POST';

      const body = profile
        ? { title, languageName, brandId: brandId || undefined }
        : { companyId, brandId: brandId || undefined, title, languageCode, languageName };

      const res = await fetch(url, {
        method,
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        toaster.show(
          profile ? 'Profile updated successfully' : 'Profile created successfully',
          'success',
        );
        onSaved();
      } else {
        const err = await res.json();
        toaster.show(err.message || 'Failed to save profile', 'warning');
      }
    } catch {
      toaster.show('Failed to save profile', 'warning');
    } finally {
      setSaving(false);
    }
  }, [companyId, brandId, title, languageCode, languageName, profile, fetch, toaster, onSaved]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-third rounded-xl p-6 border border-tableBorder w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {profile ? 'Edit Profile' : 'Create AyrShare Profile'}
          </h3>
          <button
            onClick={onClose}
            className="text-inputText hover:text-white p-1 rounded hover:bg-fifth transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. MyBrand English, CompanyName CZ"
              className="w-full bg-input text-inputText rounded-lg px-3 py-2 text-sm border border-tableBorder focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Company</label>
            <select
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setBrandId('');
              }}
              disabled={!!profile}
              className="w-full bg-input text-inputText rounded-lg px-3 py-2 text-sm border border-tableBorder focus:border-primary outline-none disabled:opacity-50"
            >
              <option value="">Select company...</option>
              {companies?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCompany?.brands && selectedCompany.brands.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Brand (optional)</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full bg-input text-inputText rounded-lg px-3 py-2 text-sm border border-tableBorder focus:border-primary outline-none"
              >
                <option value="">No specific brand</option>
                {selectedCompany.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Language</label>
              <select
                value={languageCode}
                onChange={(e) => {
                  setLanguageCode(e.target.value);
                  const lang = LANGUAGES.find((l) => l.code === e.target.value);
                  if (lang) setLanguageName(lang.name);
                }}
                disabled={!!profile}
                className="w-full bg-input text-inputText rounded-lg px-3 py-2 text-sm border border-tableBorder focus:border-primary outline-none disabled:opacity-50"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!profile && (
            <p className="text-xs text-inputText">
              A new AyrShare sub-profile will be created. After creation, use the &quot;Link Accounts&quot; button to connect social media accounts through AyrShare&apos;s secure OAuth flow.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-tableBorder hover:bg-fifth transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !title.trim() || !companyId}
              className="px-4 py-2 bg-primary text-textColor rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving...' : profile ? 'Update' : 'Create Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
