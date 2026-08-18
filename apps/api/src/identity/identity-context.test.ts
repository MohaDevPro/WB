import { describe, expect, it } from 'vitest';

import { getBearerToken } from './identity-context.js';

describe('getBearerToken', () => {
  it('returns a single bearer token', () => {
    expect(getBearerToken('Bearer token-value')).toBe('token-value');
  });

  it('rejects absent, malformed, and non-bearer authorization headers', () => {
    expect(getBearerToken(undefined)).toBeUndefined();
    expect(getBearerToken('Basic token-value')).toBeUndefined();
    expect(getBearerToken('Bearer')).toBeUndefined();
    expect(getBearerToken('Bearer first second')).toBeUndefined();
    expect(getBearerToken(['Bearer token-value'])).toBeUndefined();
  });
});
