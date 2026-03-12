'use client';

import { FC, useState, useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useUploadPostProfiles, UploadPostProfileData } from './hooks/use-upload-post-profiles';
import { ProfileForm } from './profile-form.component';
import { QuotaIndicator } from './quota-indicator.component';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';

const LANGUAGE_FLAGS: Record<string, string> = {
  cs: '🇨🇿',
  sk: '🇸🇰',
  hu: '🇭🇺',
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸',
  it: '🇮🇹',
  pl: '🇵🇱',
  pt: '🇵🇹',
};

export const ProfileList: FC = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { data: profiles, isLoading, mutate } = useUploadPostProfiles();

  const [showForm, setShowForm] = useState(false);
  const [editProfile, setEditProfile] = useState<UploadPostProfileData | undefined>(undefined);

  const openCreateForm = useCallback(() => {
    setEditProfile(undefined);
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((profile: UploadPostProfileData) => {
    setEditProfile(profile);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditProfile(undefined);
  }, []);

  const onSaved = useCallback(() => {
    closeForm();
    mutate();
  }, [closeForm, mutate]);

  const deleteProfile = useCallback(
    async (profile: UploadPostProfileData) => {
      if (
        !(await deleteDialog(
          `Are you sure you want to delete the profile "${profile.profileUsername}"? This will also remove the associated integration.`,
        ))
      ) {
        return;
      }

      try {
        const res = await fetch(`/upload-post/profiles/${profile.id}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          toaster.show('Profile deleted successfully', 'success');
          mutate();
        } else {
          toaster.show('Failed to delete profile', 'warning');
        }
      } catch {
        toaster.show('Failed to delete profile', 'warning');
      }
    },
    [fetch, mutate, toaster],
  );

  if (isLoading) {
    return (
      <div className="bg-third rounded-xl p-6 border border-tableBorder">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-fifth rounded w-1/4" />
          <div className="h-10 bg-fifth rounded" />
          <div className="h-10 bg-fifth rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-third rounded-xl p-6 border border-tableBorder">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Profiles</h3>
        <button
          onClick={openCreateForm}
          className="px-4 py-2 bg-primary text-textColor rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Profile
        </button>
      </div>

      <div className="mb-4">
        <QuotaIndicator />
      </div>

      {(!profiles || profiles.length === 0) ? (
        <div className="text-center py-12 text-inputText">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50">
            <path d="M12 16V8m0 0l-4 4m4-4l4 4M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm mb-1">No profiles created yet</p>
          <p className="text-xs">
            Create your first Upload-Post profile to start publishing
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tableBorder text-left text-inputText">
                <th className="pb-2 pr-4 font-medium">Company</th>
                <th className="pb-2 pr-4 font-medium">Language</th>
                <th className="pb-2 pr-4 font-medium">Profile Username</th>
                <th className="pb-2 pr-4 font-medium">Platforms</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr
                  key={profile.id}
                  className="border-b border-tableBorder/50 hover:bg-fifth/50 transition-colors"
                >
                  <td className="py-3 pr-4">
                    {profile.company?.name || 'Unknown'}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-1">
                      <span>{LANGUAGE_FLAGS[profile.languageCode] || ''}</span>
                      <span>{profile.languageName}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <code className="text-xs font-mono bg-fifth px-2 py-1 rounded">
                      {profile.profileUsername}
                    </code>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {profile.platforms.slice(0, 4).map((p) => (
                        <span
                          key={p}
                          className="text-xs bg-fifth px-2 py-0.5 rounded capitalize"
                        >
                          {p}
                        </span>
                      ))}
                      {profile.platforms.length > 4 && (
                        <span className="text-xs bg-fifth px-2 py-0.5 rounded text-inputText">
                          +{profile.platforms.length - 4}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        profile.enabled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {profile.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditForm(profile)}
                        className="text-xs text-inputText hover:text-white px-2 py-1 rounded hover:bg-fifth transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProfile(profile)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ProfileForm
          profile={editProfile}
          onClose={closeForm}
          onSaved={onSaved}
        />
      )}
    </div>
  );
};
