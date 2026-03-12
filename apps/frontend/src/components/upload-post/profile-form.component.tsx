'use client';

import { FC, useState, useCallback, useMemo } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useCompanies, Company } from '@gitroom/frontend/components/company-switcher/use-companies';
import { UploadPostProfileData } from './hooks/use-upload-post-profiles';

const LANGUAGES = [
  { code: 'cs', name: 'Czech', flag: '🇨🇿' },
  { code: 'sk', name: 'Slovak', flag: '🇸🇰' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
];

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'x', label: 'X (Twitter)' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'threads', label: 'Threads' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'google-business', label: 'Google Business' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'discord', label: 'Discord' },
  { id: 'mastodon', label: 'Mastodon' },
];

interface ProfileFormProps {
  profile?: UploadPostProfileData;
  onClose: () => void;
  onSaved: () => void;
}

export const ProfileForm: FC<ProfileFormProps> = ({ profile, onClose, onSaved }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { companies } = useCompanies();

  const [companyId, setCompanyId] = useState(profile?.company?.id || '');
  const [brandSlug, setBrandSlug] = useState('main');
  const [languageCode, setLanguageCode] = useState(profile?.languageCode || '');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    profile?.platforms || [],
  );
  const [saving, setSaving] = useState(false);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId) || null,
    [companies, companyId],
  );

  const selectedLanguage = useMemo(
    () => LANGUAGES.find((l) => l.code === languageCode) || null,
    [languageCode],
  );

  const generatedUsername = useMemo(() => {
    if (!selectedCompany || !languageCode) return '';
    return `${selectedCompany.slug}__${brandSlug}__${languageCode}`;
  }, [selectedCompany, brandSlug, languageCode]);

  const togglePlatform = useCallback((platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId],
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!companyId) {
      toaster.show('Please select a company', 'warning');
      return;
    }
    if (!languageCode) {
      toaster.show('Please select a language', 'warning');
      return;
    }
    if (selectedPlatforms.length === 0) {
      toaster.show('Please select at least one platform', 'warning');
      return;
    }

    setSaving(true);
    try {
      const body = {
        companyId,
        companySlug: selectedCompany!.slug,
        companyName: selectedCompany!.name,
        brandSlug,
        languageCode,
        languageName: selectedLanguage!.name,
        platforms: selectedPlatforms,
      };

      const url = profile
        ? `/upload-post/profiles/${profile.id}`
        : '/upload-post/profiles';
      const method = profile ? 'PUT' : 'POST';

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
  }, [
    companyId,
    languageCode,
    selectedPlatforms,
    selectedCompany,
    selectedLanguage,
    brandSlug,
    profile,
    fetch,
    toaster,
    onSaved,
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-third rounded-xl border border-tableBorder w-full max-w-lg max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">
            {profile ? 'Edit Profile' : 'Create Profile'}
          </h3>
          <button onClick={onClose} className="text-inputText hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Company */}
          <div>
            <label className="block text-sm font-medium mb-1">Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={!!profile}
              className="w-full bg-input text-inputText rounded-lg px-3 py-2 text-sm border border-tableBorder focus:border-primary outline-none disabled:opacity-50"
            >
              <option value="">Select a company...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Brand Slug */}
          <div>
            <label className="block text-sm font-medium mb-1">Brand Slug</label>
            <input
              type="text"
              value={brandSlug}
              onChange={(e) => setBrandSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="main"
              className="w-full bg-input text-inputText rounded-lg px-3 py-2 text-sm border border-tableBorder focus:border-primary outline-none"
            />
            <p className="text-xs text-inputText mt-1">
              Used in the profile username. Use &quot;main&quot; for the primary brand.
            </p>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium mb-1">Language</label>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguageCode(lang.code)}
                  disabled={!!profile}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    languageCode === lang.code
                      ? 'border-primary bg-primary/10'
                      : 'border-tableBorder hover:border-primary/50'
                  } disabled:opacity-50`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generated Username Preview */}
          {generatedUsername && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Profile Username
              </label>
              <div className="bg-fifth rounded-lg px-3 py-2 text-sm font-mono border border-tableBorder">
                {generatedUsername}
              </div>
              <p className="text-xs text-inputText mt-1">
                This must match your Upload-Post profile name exactly.
              </p>
            </div>
          )}

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Platforms ({selectedPlatforms.length} selected)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    selectedPlatforms.includes(platform.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-tableBorder hover:border-primary/50'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-sm border ${
                      selectedPlatforms.includes(platform.id)
                        ? 'bg-primary border-primary'
                        : 'border-inputText'
                    }`}
                  >
                    {selectedPlatforms.includes(platform.id) && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="white" className="w-3 h-3">
                        <path d="M10 3L4.5 8.5 2 6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span>{platform.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-tableBorder">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-tableBorder hover:bg-fifth transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !companyId || !languageCode || selectedPlatforms.length === 0}
            className="px-4 py-2 bg-primary text-textColor rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : profile
              ? 'Update Profile'
              : 'Create Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};
