import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns a minimal healthy status without operational details', () => {
    expect(new HealthController().getHealth()).toEqual({ status: 'ok' });
  });
});
