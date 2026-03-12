'use client';

import { FC, useState, useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useUploadPostConfig } from './hooks/use-upload-post-config';

export const ConfigPanel: FC = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { data: config, mutate, isLoading } = useUploadPostConfig();

  const [apiKey, setApiKey] = useState('');
  const [planType, setPlanType] = useState('professional');
  const [maxProfiles, setMaxProfiles] = useState(25);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  const saveConfig = useCallback(async () => {
    if (!apiKey.trim()) {
      toaster.show('Please enter an API key', 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/upload-post/config', {
        method: 'POST',
        body: JSON.stringify({ apiKey, planType, maxProfiles }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        toaster.show('Configuration saved successfully', 'success');
        setApiKey('');
        mutate();
      } else {
        const err = await res.json();
        toaster.show(err.message || 'Failed to save configuration', 'warning');
      }
    } catch {
      toaster.show('Failed to save configuration', 'warning');
    } finally {
      setSaving(false);
    }
  }, [apiKey, planType, maxProfiles, fetch, mutate, toaster]);

  const verifyKey = useCallback(async () => {
    const keyToVerify = apiKey.trim() || undefined;
    setVerifying(true);
    setVerified(null);
    try {
      const res = await fetch('/upload-post/config/verify', {
        method: 'POST',
        body: JSON.stringify({ apiKey: keyToVerify }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setVerified(data.valid === true);
      if (data.valid) {
        toaster.show('API key is valid', 'success');
      } else {
        toaster.show('API key is invalid', 'warning');
      }
    } catch {
      setVerified(false);
      toaster.show('Verification failed', 'warning');
    } finally {
      setVerifying(false);
    }
  }, [apiKey, fetch, toaster]);

  const deleteConfig = useCallback(async () => {
    try {
      const res = await fetch('/upload-post/config', { method: 'DELETE' });
      if (res.ok) {
        toaster.show('Configuration removed', 'success');
        mutate();
      }
    } catch {
      toaster.show('Failed to remove configuration', 'warning');
    }
  }, [fetch, mutate, toaster]);

  if (isLoading) {
    return (
      <div className="bg-third rounded-xl p-6 border border-tableBorder">
        <div className="animate-pulse h-6 bg-fifth rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className="bg-third rounded-xl p-6 border border-tableBorder">
      <h3 className="text-lg font-semibold mb-4">API Configuration</h3>

      {config && (
        <div className="mb-4 p-3 bg-fifth rounded-lg flex items-center justify-between">
          <div>
            <span className="text-sm text-inputText">Current API Key: </span>
            <code className="text-sm font-mono">{config.apiKeyMasked}</code>
          </div>
          <div className="flex items-center gap-2">
            {config.lastVerifiedAt && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Verified
              </span>
            )}
            <button
              onClick={deleteConfig}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            {config ? 'Update API Key' : 'API Key'}
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setVerified(null);
                }}
                placeholder="Enter your Upload-Post API key"
                className="w-full bg-input text-inputText rounded-lg px-3 py-2 text-sm border border-tableBorder focus:border-primary outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-inputText hover:text-white text-xs"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <button
              onClick={verifyKey}
              disabled={verifying}
              className="px-3 py-2 text-sm rounded-lg border border-tableBorder hover:bg-fifth transition-colors disabled:opacity-50"
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </button>
          </div>
          {verified !== null && (
            <div className={`mt-1 text-xs flex items-center gap-1 ${verified ? 'text-green-400' : 'text-red-400'}`}>
              {verified ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  API key is valid
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  API key is invalid
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Plan Type</label>
            <select
              value={planType}
              onChange={(e) => {
                setPlanType(e.target.value);
                if (e.target.value === 'starter') setMaxProfiles(10);
                else if (e.target.value === 'professional') setMaxProfiles(25);
                else if (e.target.value === 'business') setMaxProfiles(100);
              }}
              className="w-full bg-input text-inputText rounded-lg px-3 py-2 text-sm border border-tableBorder focus:border-primary outline-none"
            >
              <option value="starter">Starter (10 profiles)</option>
              <option value="professional">Professional (25 profiles)</option>
              <option value="business">Business (100 profiles)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Max Profiles</label>
            <input
              type="number"
              value={maxProfiles}
              onChange={(e) => setMaxProfiles(Number(e.target.value))}
              min={1}
              className="w-full bg-input text-inputText rounded-lg px-3 py-2 text-sm border border-tableBorder focus:border-primary outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveConfig}
            disabled={saving || !apiKey.trim()}
            className="px-4 py-2 bg-primary text-textColor rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving...' : config ? 'Update Configuration' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};
