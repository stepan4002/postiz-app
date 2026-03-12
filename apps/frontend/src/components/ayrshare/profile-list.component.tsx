'use client';

import { FC, useState, useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useAyrShareProfiles, AyrShareProfileData } from './hooks/use-ayrshare-profiles';
import { AyrShareProfileForm } from './profile-form.component';
import { AyrShareQuotaIndicator } from './quota-indicator.component';
import { AyrShareSocialLinker } from './social-linker.component';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';

const LANGUAGE_FLAGS: Record<string, string> = {
  cs: '\u{1F1E8}\u{1F1FF}',
  sk: '\u{1F1F8}\u{1F1F0}',
  hu: '\u{1F1ED}\u{1F1FA}',
  en: '\u{1F1EC}\u{1F1E7}',
  de: '\u{1F1E9}\u{1F1EA}',
  fr: '\u{1F1EB}\u{1F1F7}',
  es: '\u{1F1EA}\u{1F1F8}',
  it: '\u{1F1EE}\u{1F1F9}',
  pl: '\u{1F1F5}\u{1F1F1}',
  pt: '\u{1F1F5}\u{1F1F9}',
};

export const AyrShareProfileList: FC = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { data: profiles, isLoading, mutate } = useAyrShareProfiles();

  const [showForm, setShowForm] = useState(false);
  const [editProfile, setEditProfile] = useState<AyrShareProfileData | undefined>(undefined);
  const [linkProfile, setLinkProfile] = useState<AyrShareProfileData | undefined>(undefined);

  const openCreateForm = useCallback(() => {
    setEditProfile(undefined);
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((profile: AyrShareProfileData) => {
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

  const openLinker = useCallback((profile: AyrShareProfileData) => {
    setLinkProfile(profile);
  }, []);

  const closeLinker = useCallback(() => {
    setLinkProfile(undefined);
  }, []);

  const onLinked = useCallback(() => {
    closeLinker();
    mutate();
  }, [closeLinker, mutate]);

  const deleteProfile = useCallback(
    async (profile: AyrShareProfileData) => {
      if (
        !(await deleteDialog(
          `Are you sure you want to delete the profile "${profile.title}"? This will remove the AyrShare sub-profile and all linked social accounts.`,
        ))
      ) {
        return;
      }

      try {
        const res = await fetch(`/ayrshare/profiles/${profile.id}`, {
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
        <h3 className="text-lg font-semibold">AyrShare Profiles</h3>
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
        <AyrShareQuotaIndicator />
      </div>

      {(!profiles || profiles.length === 0) ? (
        <div className="text-center py-12 text-inputText">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <p className="text-sm mb-1">No profiles created yet</p>
          <p className="text-xs">
            Create your first AyrShare profile to start publishing across 13 platforms
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tableBorder text-left text-inputText">
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Company</th>
                <th className="pb-2 pr-4 font-medium">Language</th>
                <th className="pb-2 pr-4 font-medium">Linked Platforms</th>
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
                  <td className="py-3 pr-4 font-medium">{profile.title}</td>
                  <td className="py-3 pr-4">
                    <div>
                      <span>{profile.company?.name || 'Unknown'}</span>
                      {profile.brand && (
                        <span className="text-xs text-inputText ml-1">
                          / {profile.brand.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-1">
                      <span>{LANGUAGE_FLAGS[profile.languageCode] || ''}</span>
                      <span>{profile.languageName}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {profile.platforms.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {profile.platforms.slice(0, 5).map((p) => (
                          <span
                            key={p}
                            className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded capitalize"
                          >
                            {p}
                          </span>
                        ))}
                        {profile.platforms.length > 5 && (
                          <span className="text-xs bg-fifth px-2 py-0.5 rounded text-inputText">
                            +{profile.platforms.length - 5}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-yellow-400">No accounts linked</span>
                    )}
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
                        onClick={() => openLinker(profile)}
                        className="text-xs text-primary hover:text-primary/80 px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                      >
                        Link Accounts
                      </button>
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
        <AyrShareProfileForm
          profile={editProfile}
          onClose={closeForm}
          onSaved={onSaved}
        />
      )}

      {linkProfile && (
        <AyrShareSocialLinker
          profileId={linkProfile.id}
          profileTitle={linkProfile.title}
          platforms={linkProfile.platforms}
          onClose={closeLinker}
          onLinked={onLinked}
        />
      )}
    </div>
  );
};
