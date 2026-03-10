import type { Config } from 'jest';

const config: Config = {
  displayName: 'multi-company',
  // Note: using standalone config (NX jest preset not installed in this project)
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        // Suppress upstream library TS errors that are pre-existing and out of scope
        diagnostics: {
          ignoreCodes: ['TS7008', 'TS7010', 'TS7011', 'TS7018'],
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['**/__tests__/**/*.spec.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@gitroom/nestjs-libraries/(.*)$': '<rootDir>/../../libraries/nestjs-libraries/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/../../libraries/helpers/src/$1',
    '^@social/company-context$': '<rootDir>/../company-context/src/index.ts',
    '^@social/multi-company$': '<rootDir>/src/index.ts',
  },
  // Integration tests require a real DB — timeout set high
  testTimeout: 30000,
};

export default config;
