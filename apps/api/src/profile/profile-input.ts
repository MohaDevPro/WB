export type AccountLocale = 'ar' | 'en';

export type ProfileUpsertInput = Readonly<{
  biography: string | null;
  displayName: string;
  locale: AccountLocale;
  skills: readonly string[];
}>;

export class ProfileValidationError extends Error {}

const allowedKeys = new Set(['biography', 'displayName', 'locale', 'skills']);
const allowedLocales = new Set<AccountLocale>(['ar', 'en']);

function parseRequiredString(value: unknown, fieldName: string, maximumLength: number): string {
  if (typeof value !== 'string') {
    throw new ProfileValidationError(`${fieldName} must be a string.`);
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0 || normalizedValue.length > maximumLength) {
    throw new ProfileValidationError(
      `${fieldName} must contain between 1 and ${maximumLength} characters.`,
    );
  }

  return normalizedValue;
}

function parseBiography(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ProfileValidationError('biography must be a string or null.');
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > 1000) {
    throw new ProfileValidationError('biography must contain no more than 1000 characters.');
  }

  return normalizedValue.length === 0 ? null : normalizedValue;
}

function parseSkills(value: unknown): readonly string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > 20) {
    throw new ProfileValidationError('skills must be an array containing no more than 20 entries.');
  }

  const skills = value.map((skill) => parseRequiredString(skill, 'skills entry', 60));
  const normalizedSkills = new Set(skills.map((skill) => skill.normalize('NFKC').toLowerCase()));

  if (normalizedSkills.size !== skills.length) {
    throw new ProfileValidationError('skills must not contain duplicates.');
  }

  return Object.freeze(skills);
}

function parseLocale(value: unknown): AccountLocale {
  if (typeof value !== 'string' || !allowedLocales.has(value as AccountLocale)) {
    throw new ProfileValidationError('locale must be either ar or en.');
  }

  return value as AccountLocale;
}

export function parseProfileUpsertInput(value: unknown): ProfileUpsertInput {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProfileValidationError('The profile body must be an object.');
  }

  const input = value as Record<string, unknown>;

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      throw new ProfileValidationError(`Unexpected profile field: ${key}.`);
    }
  }

  return Object.freeze({
    biography: parseBiography(input.biography),
    displayName: parseRequiredString(input.displayName, 'displayName', 120),
    locale: parseLocale(input.locale),
    skills: parseSkills(input.skills),
  });
}
