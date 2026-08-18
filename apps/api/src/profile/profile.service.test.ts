import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ProfileService } from './profile.service.js';

describe('ProfileService', () => {
  it('creates an internal user link, upserts a private profile, and records a non-sensitive audit event', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '7da4c5be-2964-4d2d-aea0-d68c1d09cfc7' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            biography: 'Community builder',
            display_name: 'Amina',
            preferred_locale: 'en',
            skills: ['TypeScript'],
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const database = {
      withTransaction: async <Result>(
        operation: (client: never) => Promise<Result>,
      ): Promise<Result> => operation({ query } as never),
    } as unknown as DatabaseService;
    const service = new ProfileService(database);

    await expect(
      service.upsertPrivateProfile(
        {
          issuer: 'https://identity.example.test/',
          subject: 'user-subject',
        },
        {
          biography: 'Community builder',
          displayName: 'Amina',
          locale: 'en',
          skills: ['TypeScript'],
        },
      ),
    ).resolves.toEqual({
      biography: 'Community builder',
      displayName: 'Amina',
      locale: 'en',
      skills: ['TypeScript'],
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO user_identities'), [
      '7da4c5be-2964-4d2d-aea0-d68c1d09cfc7',
      'https://identity.example.test/',
      'user-subject',
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO identity_audit_events'),
      [
        '7da4c5be-2964-4d2d-aea0-d68c1d09cfc7',
        JSON.stringify({ fields: ['biography', 'displayName', 'locale', 'skills'] }),
      ],
    );
  });
});
