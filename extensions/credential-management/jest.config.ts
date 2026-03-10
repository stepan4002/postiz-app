import type { Config } from 'jest';

const config: Config = {
  displayName: 'credential-management',
  // Note: using standalone config (NX jest preset not installed in this project)
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
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
    '^@social/credential-management$': '<rootDir>/src/index.ts',
  },
  testTimeout: 10000,
};

export default config;
