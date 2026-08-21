export const V0_MIN_PASSWORD_LENGTH = 10;

export const V0_VISIBILITIES = ['public', 'private'] as const;
export type V0Visibility = (typeof V0_VISIBILITIES)[number];

export const V0_REGISTRATION_STATES = ['registered', 'cancelled'] as const;

export function isValidPassword(password: string) {
  return password.length >= V0_MIN_PASSWORD_LENGTH;
}

export function isValidPhone(phoneNumber: string) {
  return /^\+[1-9][0-9]{7,14}$/.test(phoneNumber);
}

export function contentBody(body: string) {
  const normalized = body.trim();
  if (!normalized) throw new Error('Content body is required');
  return normalized;
}

export function membershipStatusFor(visibility: 'public' | 'closed', platformRole: string) {
  return visibility === 'public' || platformRole === 'platform_admin' ? 'active' : 'pending';
}
