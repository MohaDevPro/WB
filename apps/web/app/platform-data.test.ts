import { describe, expect, it } from 'vitest';

import { copy, featuredPeople, navigation, platformStats } from './platform-data.js';

describe('platform demo data', () => {
  it('provides bilingual navigation labels for every visible platform surface', () => {
    expect(navigation.map((item) => item.id)).toEqual([
      'home',
      'discover',
      'community',
      'events',
      'profile',
    ]);

    for (const item of navigation) {
      expect(copy(item.label, 'ar')).not.toHaveLength(0);
      expect(copy(item.label, 'en')).not.toHaveLength(0);
    }
  });

  it('keeps statistics and featured professional data available in both locales', () => {
    expect(platformStats).toHaveLength(3);
    expect(featuredPeople).toHaveLength(3);
    expect(copy(featuredPeople[0].name, 'ar')).toBe('ريما العتيبي');
    expect(copy(featuredPeople[0].name, 'en')).toBe('Reema Alotaibi');
  });
});
