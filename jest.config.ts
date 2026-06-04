import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'bundler',
        },
      },
    ],
  },
  testMatch: ['**/tests/jest/**/*.test.ts'],
  forceExit: true,
};

export default config;
