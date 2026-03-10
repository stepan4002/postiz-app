'use client';

import React, { FC, useState } from 'react';
import { useCompany } from '../company-switcher/company-context';
import { useBrands } from './hooks/use-brands';
import { useGeneratePost, GenerateResult } from './hooks/use-generate-post';
import { MediaPicker } from './media-picker';
import { PlatformSelector } from './platform-selector';
import { ContentTypeSelector } from './content-type-selector';
import { GenerationResult } from './generation-result';

/**
 * CreatePostForm
 *
 * Main content generation input form. Composes:
 * - Brand selector (populated from API)
 * - MediaPicker (library selection + inline upload)
 * - ContentTypeSelector (7 AI content types)
 * - Brief textarea (optional)
 * - PlatformSelector (4 platforms multi-select)
 * - Generate button
 * - GenerationResult preview
 */
export const CreatePostForm: FC = () => {
  const { companySlug } = useCompany();

  const { data: brands, isLoading: brandsLoading } = useBrands(
    companySlug ?? ''
  );
  const { generate, isLoading, error } = useGeneratePost(companySlug ?? '');

  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [brief, setBrief] = useState('');
  const [contentType, setContentType] = useState('product');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const canGenerate =
    !!selectedBrandId && selectedPlatforms.length > 0 && !isLoading;

  const handleGenerate = async () => {
    if (!canGenerate || !companySlug) return;
    setInlineError(null);
    setResult(null);

    try {
      const generated = await generate({
        brandId: selectedBrandId,
        mediaId: selectedMediaId ?? undefined,
        brief: brief.trim() || undefined,
        contentType,
        platforms: selectedPlatforms,
      });
      setResult(generated);
    } catch (err: any) {
      setInlineError(err?.message ?? 'Generation failed. Please try again.');
    }
  };

  if (!companySlug) {
    return (
      <div className="text-[13px] text-textItemBlur text-center py-[40px]">
        No company selected. Use ?c=slug in the URL.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-[24px] p-[24px]">
      {/* Brand selector */}
      <div className="space-y-[6px]">
        <label className="block text-[13px] font-[600] text-textColor">
          Brand
        </label>
        {brandsLoading ? (
          <div className="h-[40px] bg-newBgColorInner border border-newBorder rounded-[8px] animate-pulse" />
        ) : (
          <select
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="w-full rounded-[8px] border border-newBorder bg-newBgColorInner text-textColor text-[13px] p-[10px] focus:outline-none focus:border-btnPrimary transition-colors duration-150"
          >
            <option value="">Select a brand...</option>
            {(brands ?? []).map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Media picker */}
      <div className="space-y-[6px]">
        <label className="block text-[13px] font-[600] text-textColor">
          Media
        </label>
        <div className="bg-newBgColorInner border border-newBorder rounded-[10px] p-[12px]">
          <MediaPicker
            companySlug={companySlug}
            selectedMediaId={selectedMediaId}
            onSelect={setSelectedMediaId}
          />
        </div>
      </div>

      {/* Content type */}
      <div className="space-y-[6px]">
        <label className="block text-[13px] font-[600] text-textColor">
          Content Type
        </label>
        <ContentTypeSelector value={contentType} onChange={setContentType} />
      </div>

      {/* Brief textarea */}
      <div className="space-y-[6px]">
        <label className="block text-[13px] font-[600] text-textColor">
          Brief{' '}
          <span className="text-[12px] font-[400] text-textItemBlur">
            (optional)
          </span>
        </label>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="Describe what you want to post about..."
          className="w-full rounded-[8px] border border-newBorder bg-newBgColorInner text-textColor text-[13px] p-[10px] focus:outline-none focus:border-btnPrimary resize-none transition-colors duration-150 placeholder:text-textItemBlur"
        />
      </div>

      {/* Platform selector */}
      <div className="space-y-[6px]">
        <label className="block text-[13px] font-[600] text-textColor">
          Target Platforms
        </label>
        <PlatformSelector
          selected={selectedPlatforms}
          onChange={setSelectedPlatforms}
        />
        {selectedPlatforms.length === 0 && (
          <p className="text-[12px] text-textItemBlur">
            Select at least one platform
          </p>
        )}
      </div>

      {/* Error message */}
      {(inlineError || error) && (
        <div className="text-[13px] text-red-400 bg-red-400/10 rounded-[8px] px-[12px] py-[8px]">
          {inlineError ?? error}
        </div>
      )}

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full py-[12px] rounded-[8px] bg-btnPrimary text-white text-[14px] font-[600] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity duration-150"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-[8px]">
            <span className="w-[14px] h-[14px] border-[2px] border-white border-t-transparent rounded-full animate-spin" />
            Generating...
          </span>
        ) : (
          'Generate Post'
        )}
      </button>

      {/* Results */}
      <GenerationResult result={result} isLoading={isLoading} />
    </div>
  );
};
