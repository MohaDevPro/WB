export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker'],
  coverageAnalysis: 'off',
  mutate: ['apps/api/src/common/v0-rules.ts'],
  reporters: ['clear-text', 'html', 'json'],
  thresholds: {
    high: 80,
    low: 70,
    break: 70,
  },
  checkers: ['typescript'],
  tsconfigFile: 'apps/api/tsconfig.json',
  concurrency: 2,
  cleanTempDir: true,
};
