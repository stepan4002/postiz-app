import type { Config } from 'jest';

const config: Config = {
  displayName: 'content-generation',
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
    '^@social/content-generation$': '<rootDir>/src/index.ts',
    '^@social/content-generation/(.*)$': '<rootDir>/src/$1',
    '^@social/ai-service$': '<rootDir>/../ai-service/src/index.ts',
    '^@social/media-library$': '<rootDir>/../media-library/src/index.ts',
    '^@gitroom/nestjs-libraries/(.*)$': '<rootDir>/../../libraries/nestjs-libraries/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/../../libraries/helpers/src/$1',
  },
  testTimeout: 10000,
};

export default config;
