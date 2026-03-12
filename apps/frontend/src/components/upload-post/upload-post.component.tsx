'use client';

import { FC, useState } from 'react';
import { ConfigPanel } from './config-panel.component';
import { ProfileList } from './profile-list.component';
import { useUploadPostConfig } from './hooks/use-upload-post-config';

type Tab = 'profiles' | 'config';

export const UploadPostComponent: FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('profiles');
  const { data: config } = useUploadPostConfig();

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold">Upload Post Gateway</h1>
        <p className="text-sm text-inputText mt-1">
          Manage your Upload-Post.com integration for unified social media publishing.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-tableBorder">
        <button
          onClick={() => setActiveTab('profiles')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'profiles'
              ? 'border-primary text-white'
              : 'border-transparent text-inputText hover:text-white'
          }`}
        >
          Profiles
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'config'
              ? 'border-primary text-white'
              : 'border-transparent text-inputText hover:text-white'
          }`}
        >
          API Configuration
          {!config && (
            <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
              Setup Required
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {!config && activeTab === 'profiles' ? (
        <div className="bg-third rounded-xl p-8 border border-tableBorder text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-yellow-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">API Key Required</h3>
          <p className="text-sm text-inputText mb-4">
            You need to configure your Upload-Post API key before creating profiles.
          </p>
          <button
            onClick={() => setActiveTab('config')}
            className="px-4 py-2 bg-primary text-textColor rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Configure API Key
          </button>
        </div>
      ) : activeTab === 'profiles' ? (
        <ProfileList />
      ) : (
        <ConfigPanel />
      )}
    </div>
  );
};
