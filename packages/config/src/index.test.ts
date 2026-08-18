import { describe, expect, it } from 'vitest';

import { getApiRuntimeConfig } from './index.js';

describe('getApiRuntimeConfig', () => {
  it('uses safe development defaults when optional values are absent', () => {
    expect(getApiRuntimeConfig({})).toEqual({
      host: '127.0.0.1',
      nodeEnv: 'development',
      port: 3001,
    });
  });

  it('accepts a valid explicit configuration', () => {
    expect(
      getApiRuntimeConfig({
        HOST: '0.0.0.0',
        NODE_ENV: 'test',
        PORT: '4310',
      }),
    ).toEqual({
      host: '0.0.0.0',
      nodeEnv: 'test',
      port: 4310,
    });
  });

  it('rejects an invalid port', () => {
    expect(() => getApiRuntimeConfig({ PORT: 'invalid' })).toThrow(
      'PORT must be an integer between 1 and 65535.',
    );
  });

  it('rejects an unsupported runtime environment', () => {
    expect(() => getApiRuntimeConfig({ NODE_ENV: 'preview' })).toThrow(
      'NODE_ENV must be development, test, or production.',
    );
  });
});
