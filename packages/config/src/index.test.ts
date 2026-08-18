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

  it('accepts a valid explicit listener configuration', () => {
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

  it('accepts complete database and OIDC configuration', () => {
    const configuration = getApiRuntimeConfig({
      DATABASE_URL: 'postgresql://wb:wb@localhost:5432/wb',
      OIDC_AUDIENCE: 'wb-api',
      OIDC_ISSUER: 'https://identity.example.test/',
      OIDC_JWKS_URI: 'https://identity.example.test/.well-known/jwks.json',
    });

    expect(configuration.databaseUrl).toBe('postgresql://wb:wb@localhost:5432/wb');
    expect(configuration.oidc).toMatchObject({ audience: 'wb-api' });
    expect(configuration.oidc?.issuer.toString()).toBe('https://identity.example.test/');
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

  it('rejects partial OIDC configuration', () => {
    expect(() => getApiRuntimeConfig({ OIDC_ISSUER: 'https://identity.example.test/' })).toThrow(
      'OIDC_ISSUER, OIDC_AUDIENCE, and OIDC_JWKS_URI must be configured together.',
    );
  });

  it('rejects malformed OIDC URLs', () => {
    expect(() =>
      getApiRuntimeConfig({
        OIDC_AUDIENCE: 'wb-api',
        OIDC_ISSUER: 'not-a-url',
        OIDC_JWKS_URI: 'https://identity.example.test/.well-known/jwks.json',
      }),
    ).toThrow('OIDC_ISSUER must be an absolute URL.');
  });
});
