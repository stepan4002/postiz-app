'use client';

import { FC, useState, useCallback, useEffect } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';

interface Props {
  profileId: string;
  profileTitle: string;
  platforms: string[];
  onClose: () => void;
  onLinked: () => void;
}

/**
 * Social Linker component.
 *
 * Opens the AyrShare JWT/SSO URL in a popup window for the user to link
 * their social media accounts. AyrShare manages all OAuth flows internally.
 */
export const AyrShareSocialLinker: FC<Props> = ({
  profileId,
  profileTitle,
  platforms,
  onClose,
  onLinked,
}) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  const generateLink = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/ayrshare/profiles/${profileId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        setLinkUrl(data.url);
      } else {
        const err = await res.json();
        toaster.show(err.message || 'Failed to generate linking URL', 'warning');
      }
    } catch {
      toaster.show('Failed to generate linking URL', 'warning');
    } finally {
      setLoading(false);
    }
  }, [fetch, profileId, toaster]);

  useEffect(() => {
    generateLink();
  }, [generateLink]);

  const openPopup = useCallback(() => {
    if (!linkUrl) return;

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      linkUrl,
      'ayrshare-social-linker',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
    );

    if (popup) {
      setPopupOpen(true);
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setPopupOpen(false);
          // Webhook will update platforms, trigger a refresh
          onLinked();
        }
      }, 500);
    } else {
      // Popup blocked — fall back to redirect
      window.open(linkUrl, '_blank');
    }
  }, [linkUrl, onLinked]);

  const PLATFORM_ICONS: Record<string, string> = {
    facebook: 'FB',
    instagram: 'IG',
    twitter: 'X',
    linkedin: 'LI',
    youtube: 'YT',
    tiktok: 'TT',
    pinterest: 'PI',
    reddit: 'RD',
    threads: 'TH',
    bluesky: 'BS',
    telegram: 'TG',
    gmb: 'GB',
    snapchat: 'SC',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-third rounded-xl p-6 border border-tableBorder w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Link Social Accounts</h3>
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

        <p className="text-sm text-inputText mb-4">
          Profile: <span className="text-white font-medium">{profileTitle}</span>
        </p>

        {/* Currently linked platforms */}
        {platforms.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-inputText mb-2">Currently linked:</p>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => (
                <span
                  key={p}
                  className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full capitalize flex items-center gap-1"
                >
                  <span className="font-mono text-[10px]">{PLATFORM_ICONS[p] || p}</span>
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Link button */}
        <div className="text-center py-4">
          {loading ? (
            <div className="animate-pulse text-sm text-inputText">
              Generating secure link...
            </div>
          ) : linkUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-inputText">
                Click the button below to open AyrShare&apos;s secure social account linking page.
                You can connect or disconnect any supported platform.
              </p>
              <button
                onClick={openPopup}
                disabled={popupOpen}
                className="px-6 py-3 bg-primary text-textColor rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {popupOpen ? 'Linking in progress...' : 'Open Social Account Linker'}
              </button>
              {popupOpen && (
                <p className="text-xs text-yellow-400">
                  A popup window is open. Complete the linking process there, then close it to continue.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-400">
              Failed to generate linking URL. Please try again.
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-tableBorder hover:bg-fifth transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
