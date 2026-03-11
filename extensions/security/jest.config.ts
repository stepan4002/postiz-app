import type { Config } from 'jest';

const config: Config = {
  displayName: 'security',
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
    '^@social/security$': '<rootDir>/src/index.ts',
  },
  testTimeout: 10000,
};

export default config;
