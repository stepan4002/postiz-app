'use client';

import React, { FC, useRef, useState } from 'react';
import clsx from 'clsx';
import { useCompanyMedia, MediaItem } from '../media/hooks/use-company-media';
import { useMediaUpload } from '../media/hooks/use-media-upload';

/**
 * Resolve a media path to a displayable URL.
 * Follows the exact pattern from media-grid.tsx:
 * uses import.meta.env.VITE_MINIO_PUBLIC_URL (not process.env — Vite browser context)
 */
function resolveMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Uses VITE_MINIO_PUBLIC_URL from the Vite browser environment.
  // Cast via `any` to avoid TypeScript error in Next.js-typed tsconfig --
  // the env var is injected by Vite at build time for the frontend bundle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const minioPublicUrl: string = (import.meta as any)?.env?.VITE_MINIO_PUBLIC_URL ?? '';
  const base = minioPublicUrl.endsWith('/')
    ? minioPublicUrl.slice(0, -1)
    : minioPublicUrl;
  return `${base}/${path}`;
}

interface MediaPickerProps {
  companySlug: string;
  selectedMediaId: string | null;
  onSelect: (mediaId: string | null) => void;
}

/**
 * MediaPicker
 *
 * Two-mode media selection component:
 * MODE 1 — Library selection: browse existing company media with pagination
 * MODE 2 — Inline upload: upload a new file directly from this form
 *
 * Implements the locked decision: both media paths supported.
 */
export const MediaPicker: FC<MediaPickerProps> = ({
  companySlug,
  selectedMediaId,
  onSelect,
}) => {
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadMedia, progress, resetProgress } = useMediaUpload();

  const { data, isLoading, mutate } = useCompanyMedia(companySlug, page);

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companySlug) return;

    const uploaded = await uploadMedia(companySlug, file, []);
    if (uploaded?.id) {
      onSelect(uploaded.id);
      // Refresh the media library so the new upload appears
      mutate();
    }
    // Reset input so user can upload same file again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelect = (item: MediaItem) => {
    if (selectedMediaId === item.id) {
      onSelect(null);
    } else {
      onSelect(item.id);
    }
  };

  const isUploading = progress.status === 'uploading';
  const uploadError = progress.status === 'error' ? progress.error : null;

  return (
    <div className="space-y-[12px]">
      {/* Upload new file button */}
      <div className="flex items-center gap-[10px]">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={clsx(
            'flex items-center gap-[6px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-[500] border transition-colors duration-150',
            isUploading
              ? 'bg-btnSimple text-textItemBlur border-newBorder cursor-not-allowed opacity-60'
              : 'bg-btnSimple text-textColor border-newBorder hover:border-btnPrimary'
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 16L8.586 11.414C9.367 10.633 10.633 10.633 11.414 11.414L16 16M14 14L15.586 12.414C16.367 11.633 17.633 11.633 18.414 12.414L20 14M14 8H14.01M6 20H18C19.105 20 20 19.105 20 18V6C20 4.895 19.105 4 18 4H6C4.895 4 4 4.895 4 6V18C4 19.105 4.895 20 6 20Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {isUploading ? 'Uploading...' : 'Upload new file'}
        </button>

        <button
          type="button"
          onClick={() => {
            onSelect(null);
            resetProgress();
          }}
          className="text-[12px] text-textItemBlur hover:text-textColor transition-colors duration-150"
        >
          No media (text only)
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Upload progress bar */}
      {isUploading && (
        <div className="w-full bg-newBorder rounded-full h-[4px]">
          <div
            className="bg-btnPrimary h-[4px] rounded-full transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="text-[12px] text-red-400 bg-red-400/10 rounded-[6px] px-[10px] py-[6px]">
          Upload failed: {uploadError}
        </div>
      )}

      {/* Media library grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-[8px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-newBgColor rounded-[8px] animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-[40px] text-center text-textItemBlur text-[13px]">
          No media in library. Upload a file above.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[8px]">
          {items.map((item) => {
            const thumbUrl = resolveMediaUrl(item.thumbnail || item.path);
            const isSelected = selectedMediaId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className={clsx(
                  'relative aspect-square rounded-[8px] overflow-hidden border-[2px] transition-all duration-150',
                  isSelected
                    ? 'border-btnPrimary ring-2 ring-btnPrimary/30'
                    : 'border-newBorder hover:border-btnPrimary/50'
                )}
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-newBgColor flex items-center justify-center text-textItemBlur text-[10px]">
                    No preview
                  </div>
                )}
                {isSelected && (
                  <div className="absolute inset-0 bg-btnPrimary/20 flex items-center justify-center">
                    <div className="w-[20px] h-[20px] rounded-full bg-btnPrimary flex items-center justify-center">
                      <svg
                        width="10"
                        height="8"
                        viewBox="0 0 10 8"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-textItemBlur">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-[10px] py-[4px] rounded-[6px] bg-btnSimple disabled:opacity-40 hover:text-textColor transition-colors duration-150"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-[10px] py-[4px] rounded-[6px] bg-btnSimple disabled:opacity-40 hover:text-textColor transition-colors duration-150"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
