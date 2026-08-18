import { describe, expect, it } from 'vitest';

import nextConfig from './next.config';

describe('nextConfig', () => {
  it('disables framework identification and applies baseline security headers', async () => {
    expect(nextConfig.poweredByHeader).toBe(false);

    const configuredHeaders = await nextConfig.headers?.();
    const responseHeaders = configuredHeaders?.[0]?.headers ?? [];

    expect(responseHeaders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        }),
        expect.objectContaining({
          key: 'X-Frame-Options',
          value: 'DENY',
        }),
      ]),
    );
  });
});
