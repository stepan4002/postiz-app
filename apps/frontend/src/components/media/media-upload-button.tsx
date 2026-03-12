'use client';

import React, { FC, useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { useMediaUpload } from './hooks/use-media-upload';

interface MediaUploadButtonProps {
  companySlug: string;
  onUploadComplete: () => void;
}

/**
 * MediaUploadButton
 *
 * Upload button for the company media library.
 * - Accepts image/* files only
 * - Optional comma-separated tags input
 * - Shows upload progress during upload
 * - On complete: calls onUploadComplete to refresh the media grid
 *
 * Uses useFetch-based upload hook (useMediaUpload) — no external UI library.
 * Styled consistently with existing Postiz UI components.
 */
export const MediaUploadButton: FC<MediaUploadButtonProps> = ({
  companySlug,
  onUploadComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tagsInput, setTagsInput] = useState('');
  const [showTagsInput, setShowTagsInput] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const { uploadMedia, progress, resetProgress } = useMediaUpload();

  const isUploading = progress.status === 'uploading';

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset the input value so the same file can be re-selected
      e.target.value = '';

      if (!file.type.startsWith('image/')) {
        return;
      }

      setPendingFile(file);
      setShowTagsInput(true);
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (!pendingFile) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const result = await uploadMedia(companySlug, pendingFile, tags);

    if (result) {
      setPendingFile(null);
      setTagsInput('');
      setShowTagsInput(false);
      onUploadComplete();
    }
  }, [pendingFile, tagsInput, companySlug, uploadMedia, onUploadComplete]);

  const handleCancel = useCallback(() => {
    setPendingFile(null);
    setTagsInput('');
    setShowTagsInput(false);
    resetProgress();
  }, [resetProgress]);

  return (
    <div className="flex flex-col gap-[8px]">
      {/* Upload trigger button */}
      <button
        type="button"
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'relative cursor-pointer flex gap-[8px] h-[44px] px-[18px] justify-center items-center rounded-[8px] transition-colors',
          'bg-btnPrimary text-white hover:opacity-90',
          isUploading && 'opacity-60 cursor-not-allowed'
        )}
      >
        {isUploading ? (
          <>
            <div className="animate-spin h-[16px] w-[16px] border-2 border-white border-t-transparent rounded-full" />
            <span className="text-[14px] font-[500]">Uploading...</span>
          </>
        ) : (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7 1V9M7 1L4 4M7 1L10 4M1 11H13V13H1V11Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[14px] font-[500]">Upload Media</span>
          </>
        )}
      </button>

      {/* Hidden file input — image/* only */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Upload confirmation panel — shown after file selection */}
      {showTagsInput && pendingFile && (
        <div className="flex flex-col gap-[8px] p-[12px] bg-newBgColorInner border border-newBorder rounded-[8px]">
          <div className="text-[12px] text-textItemBlur truncate">
            <span className="font-[500] text-textColor">File: </span>
            {pendingFile.name}
          </div>

          {/* Tags input */}
          <div className="flex flex-col gap-[4px]">
            <label className="text-[11px] text-textItemBlur">
              Tags (comma-separated, optional)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. product, campaign, social"
              disabled={isUploading}
              className="h-[32px] px-[8px] text-[12px] bg-newBgColor border border-newBorder rounded-[6px] text-textColor placeholder:text-textItemBlur outline-none focus:border-btnPrimary transition-colors"
            />
          </div>

          {/* Upload error */}
          {progress.status === 'error' && (
            <div className="text-[11px] text-red-400">{progress.error}</div>
          )}

          {/* Action buttons */}
          <div className="flex gap-[6px]">
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className={clsx(
                'flex-1 h-[32px] px-[12px] text-[12px] font-[500] rounded-[6px] transition-colors',
                'bg-btnPrimary text-white hover:opacity-90',
                isUploading && 'opacity-60 cursor-not-allowed'
              )}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isUploading}
              className="h-[32px] px-[12px] text-[12px] font-[500] rounded-[6px] bg-btnSimple text-textColor hover:opacity-80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
