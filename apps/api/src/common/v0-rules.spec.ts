import { describe, expect, it } from 'vitest';
import {
  V0_MIN_PASSWORD_LENGTH,
  V0_REGISTRATION_STATES,
  V0_VISIBILITIES,
  contentBody,
  isValidPassword,
  isValidPhone,
  membershipStatusFor,
} from './v0-rules';

describe('WB V0 rules', () => {
  it('accepts only passwords at the configured minimum', () => {
    expect(V0_MIN_PASSWORD_LENGTH).toBe(10);
    expect(isValidPassword('123456789')).toBe(false);
    expect(isValidPassword('1234567890')).toBe(true);
    expect(isValidPassword('ChangeMe123!')).toBe(true);
  });

  it('accepts E.164-like phone input and rejects unsafe values', () => {
    expect(isValidPhone('+966500000000')).toBe(true);
    expect(isValidPhone('+12025550123')).toBe(true);
    expect(isValidPhone('0500000000')).toBe(false);
    expect(isValidPhone('+000000000')).toBe(false);
    expect(isValidPhone('+123')).toBe(false);
  });

  it('normalizes content and rejects empty input', () => {
    expect(contentBody('  فكرة عملية  ')).toBe('فكرة عملية');
    expect(() => contentBody('   ')).toThrow('Content body is required');
  });

  it('keeps V0 visibility and registration contracts intentionally small', () => {
    expect(V0_VISIBILITIES).toEqual(['public', 'private']);
    expect(V0_REGISTRATION_STATES).toEqual(['registered', 'cancelled']);
  });

  it('activates public membership and queues closed membership', () => {
    expect(membershipStatusFor('public', 'member')).toBe('active');
    expect(membershipStatusFor('closed', 'member')).toBe('pending');
    expect(membershipStatusFor('closed', 'platform_admin')).toBe('active');
  });
});
