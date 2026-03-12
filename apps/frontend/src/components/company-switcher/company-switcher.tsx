'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { useCompanies } from './use-companies';
import { useCompany } from './company-context';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { mutate } from 'swr';

export const CompanySwitcher = () => {
  const { companies, isLoading } = useCompanies();
  const { company: currentCompany } = useCompany();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fetch = useFetch();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [creating, setCreating] = useState(false);

  // Auto-select first company alphabetically when no company is selected
  useEffect(() => {
    if (!isLoading && companies.length > 0 && !searchParams.get('c')) {
      const sorted = [...companies].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      const firstSlug = sorted[0].slug;
      const params = new URLSearchParams(searchParams.toString());
      params.set('c', firstSlug);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [isLoading, companies, searchParams, pathname, router]);

  const switchToCompany = useCallback(
    (slug: string) => () => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('c', slug);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const handleCreateCompany = useCallback(async () => {
    if (!newCompanyName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/companies', {
        method: 'POST',
        body: JSON.stringify({ name: newCompanyName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        // Revalidate the companies SWR cache
        await mutate('companies');
        setNewCompanyName('');
        setShowCreateForm(false);
        // Switch to the newly created company
        const params = new URLSearchParams(searchParams.toString());
        params.set('c', created.slug);
        router.push(`${pathname}?${params.toString()}`);
      }
    } finally {
      setCreating(false);
    }
  }, [newCompanyName, creating, fetch, searchParams, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-[8px] px-[8px] py-[4px] rounded-[8px] bg-btnSimple animate-pulse">
        <div className="w-[16px] h-[16px] rounded-full bg-textItemBlur" />
        <div className="w-[80px] h-[14px] rounded bg-textItemBlur" />
      </div>
    );
  }

  // Show a "Create Company" button when there are no companies yet
  if (companies.length === 0) {
    return (
      <div className="relative flex items-center">
        {!showCreateForm ? (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className={clsx(
              'flex items-center gap-[8px] px-[10px] py-[6px] rounded-[8px]',
              'text-[13px] font-[600] text-btnPrimary',
              'bg-btnSimple hover:bg-boxHover transition-colors cursor-pointer',
              'border border-btnPrimary border-dashed'
            )}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>Create Company</span>
          </button>
        ) : (
          <div className="flex items-center gap-[6px]">
            <input
              type="text"
              autoFocus
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCompany()}
              placeholder="Company name..."
              className={clsx(
                'px-[10px] py-[5px] rounded-[8px] text-[13px]',
                'bg-newBgColorInner border border-newBorder text-newTextColor',
                'placeholder:text-textItemBlur focus:outline-none focus:border-btnPrimary',
                'w-[160px]'
              )}
            />
            <button
              type="button"
              onClick={handleCreateCompany}
              disabled={creating || !newCompanyName.trim()}
              className={clsx(
                'px-[10px] py-[5px] rounded-[8px] text-[13px] font-[600]',
                'bg-btnPrimary text-white cursor-pointer',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {creating ? '...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreateForm(false); setNewCompanyName(''); }}
              className="text-textItemBlur hover:text-newTextColor text-[18px] px-[4px] cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  }

  const displayName = currentCompany?.name ?? 'Select Company';

  return (
    <div className="group relative flex items-center">
      {/* Trigger button */}
      <button
        type="button"
        className={clsx(
          'flex items-center gap-[8px] px-[10px] py-[6px] rounded-[8px]',
          'text-[13px] font-[600] text-textItemBlur hover:text-newTextColor',
          'bg-btnSimple hover:bg-boxHover transition-colors cursor-pointer',
          'border border-transparent hover:border-newBorder'
        )}
      >
        {/* Company initial avatar */}
        <span
          className={clsx(
            'flex items-center justify-center',
            'w-[20px] h-[20px] rounded-full text-[10px] font-[700]',
            'bg-btnPrimary text-white shrink-0'
          )}
        >
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[120px] truncate">{displayName}</span>
        {/* Chevron */}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown */}
      <div
        className={clsx(
          'hidden group-hover:flex',
          'absolute top-[calc(100%+4px)] end-0 z-[100]',
          'flex-col min-w-[180px]',
          'bg-newBgColorInner border border-newBorder rounded-[10px]',
          'shadow-menu py-[6px]',
          'animate-normalFadeIn'
        )}
      >
        {companies.map((c) => {
          const isActive = c.slug === currentCompany?.slug;
          return (
            <button
              key={c.id}
              type="button"
              onClick={switchToCompany(c.slug)}
              className={clsx(
                'flex items-center gap-[10px] px-[12px] py-[8px]',
                'text-[13px] font-[500] cursor-pointer w-full text-start',
                'hover:bg-boxHover transition-colors',
                isActive
                  ? 'text-newTextColor'
                  : 'text-textItemBlur hover:text-newTextColor'
              )}
            >
              {/* Company initial avatar */}
              <span
                className={clsx(
                  'flex items-center justify-center shrink-0',
                  'w-[24px] h-[24px] rounded-full text-[11px] font-[700]',
                  isActive
                    ? 'bg-btnPrimary text-white'
                    : 'bg-btnSimple text-textItemBlur'
                )}
              >
                {c.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex flex-col gap-[1px] overflow-hidden">
                <span className="truncate">{c.name}</span>
                {c.industry && (
                  <span className="text-[11px] text-textItemBlur truncate">
                    {c.industry}
                  </span>
                )}
              </div>
              {isActive && (
                <svg
                  className="ms-auto shrink-0"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 7L5.5 10.5L12 3.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          );
        })}

        {/* Separator + Add Company */}
        <div className="h-[1px] bg-newBorder mx-[8px] my-[4px]" />
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className={clsx(
            'flex items-center gap-[10px] px-[12px] py-[8px]',
            'text-[13px] font-[500] cursor-pointer w-full text-start',
            'hover:bg-boxHover transition-colors text-btnPrimary'
          )}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>Add Company</span>
        </button>

        {/* Inline create form */}
        {showCreateForm && (
          <div className="px-[12px] py-[8px] flex flex-col gap-[6px]">
            <input
              type="text"
              autoFocus
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') handleCreateCompany();
                if (e.key === 'Escape') { setShowCreateForm(false); setNewCompanyName(''); }
              }}
              placeholder="Company name..."
              className={clsx(
                'px-[8px] py-[5px] rounded-[6px] text-[12px] w-full',
                'bg-newBgColor border border-newBorder text-newTextColor',
                'placeholder:text-textItemBlur focus:outline-none focus:border-btnPrimary'
              )}
            />
            <div className="flex gap-[4px]">
              <button
                type="button"
                onClick={handleCreateCompany}
                disabled={creating || !newCompanyName.trim()}
                className={clsx(
                  'flex-1 px-[8px] py-[4px] rounded-[6px] text-[11px] font-[600]',
                  'bg-btnPrimary text-white cursor-pointer',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setNewCompanyName(''); }}
                className="px-[8px] py-[4px] rounded-[6px] text-[11px] text-textItemBlur hover:text-newTextColor cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
