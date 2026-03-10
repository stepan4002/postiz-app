'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { useCompanies } from './use-companies';
import { useCompany } from './company-context';

export const CompanySwitcher = () => {
  const { companies, isLoading } = useCompanies();
  const { company: currentCompany } = useCompany();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  if (isLoading) {
    return (
      <div className="flex items-center gap-[8px] px-[8px] py-[4px] rounded-[8px] bg-btnSimple animate-pulse">
        <div className="w-[16px] h-[16px] rounded-full bg-textItemBlur" />
        <div className="w-[80px] h-[14px] rounded bg-textItemBlur" />
      </div>
    );
  }

  if (companies.length === 0) {
    return null;
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
      </div>
    </div>
  );
};
