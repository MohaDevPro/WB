import { describe, expect, it } from 'vitest';

import { parseProfileUpsertInput, ProfileValidationError } from './profile-input.js';

describe('parseProfileUpsertInput', () => {
  it('normalizes and accepts the bounded private profile payload', () => {
    expect(
      parseProfileUpsertInput({
        biography: '  بناء مجتمعات مهنية موثوقة.  ',
        displayName: '  محمد أمين  ',
        locale: 'ar',
        skills: ['TypeScript', 'Product strategy'],
      }),
    ).toEqual({
      biography: 'بناء مجتمعات مهنية موثوقة.',
      displayName: 'محمد أمين',
      locale: 'ar',
      skills: ['TypeScript', 'Product strategy'],
    });
  });

  it('uses private-safe optional defaults for biography and skills', () => {
    expect(
      parseProfileUpsertInput({
        displayName: 'Amina',
        locale: 'en',
      }),
    ).toEqual({
      biography: null,
      displayName: 'Amina',
      locale: 'en',
      skills: [],
    });
  });

  it('rejects unexpected fields', () => {
    expect(() =>
      parseProfileUpsertInput({
        displayName: 'Amina',
        locale: 'en',
        public: true,
      }),
    ).toThrow(ProfileValidationError);
  });

  it('rejects duplicated normalized skills', () => {
    expect(() =>
      parseProfileUpsertInput({
        displayName: 'Amina',
        locale: 'en',
        skills: ['TypeScript', 'typescript'],
      }),
    ).toThrow('skills must not contain duplicates.');
  });

  it('requires an explicit supported locale', () => {
    expect(() => parseProfileUpsertInput({ displayName: 'Amina', locale: 'fr' })).toThrow(
      'locale must be either ar or en.',
    );
  });
});
