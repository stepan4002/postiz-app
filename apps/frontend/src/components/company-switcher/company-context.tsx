'use client';

import React, {
  createContext,
  FC,
  ReactNode,
  useContext,
  useMemo,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { Company, useCompanies } from './use-companies';

interface CompanyContextValue {
  company: Company | null;
  companySlug: string | null;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export const CompanyProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('c');

  const { companies } = useCompanies();

  const company = useMemo(() => {
    if (!companySlug || companies.length === 0) return null;
    return companies.find((c) => c.slug === companySlug) ?? null;
  }, [companySlug, companies]);

  const value: CompanyContextValue = {
    company,
    companySlug,
  };

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
};

export const useCompany = (): CompanyContextValue => {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error('useCompany must be used inside CompanyProvider');
  }
  return ctx;
};

export { CompanyContext };
