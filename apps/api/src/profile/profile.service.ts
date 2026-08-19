import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { DatabaseClient } from '../database/database.types.js';
import type { AuthenticatedIdentity } from '../identity/identity-context.js';
import type { ProfileUpsertInput } from './profile-input.js';

export type PrivateProfile = Readonly<{
  biography: string | null;
  displayName: string;
  locale: 'ar' | 'en';
  skills: readonly string[];
}>;

type ProfileRow = {
  biography: string | null;
  display_name: string;
  preferred_locale: 'ar' | 'en';
  skills: unknown;
};

@Injectable()
export class ProfileService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getPrivateProfile(identity: AuthenticatedIdentity): Promise<PrivateProfile> {
    return this.database.withTransaction(async (client) => {
      const userId = await this.ensureUser(client, identity);
      const profileResult = await client.query<ProfileRow>(
        `
          SELECT
            profiles.biography,
            profiles.display_name,
            users.preferred_locale,
            profiles.skills
          FROM profiles
          INNER JOIN users ON users.id = profiles.user_id
          WHERE profiles.user_id = $1
        `,
        [userId],
      );
      const profile = profileResult.rows[0];

      if (profile === undefined) {
        throw new NotFoundException('A profile has not been created.');
      }

      return this.toPrivateProfile(profile);
    });
  }

  async upsertPrivateProfile(
    identity: AuthenticatedIdentity,
    input: ProfileUpsertInput,
  ): Promise<PrivateProfile> {
    return this.database.withTransaction(async (client) => {
      const userId = await this.ensureUser(client, identity);
      await client.query(
        `
          UPDATE users
          SET preferred_locale = $2, updated_at = now()
          WHERE id = $1
        `,
        [userId, input.locale],
      );

      const profileResult = await client.query<ProfileRow>(
        `
          INSERT INTO profiles (user_id, display_name, biography, skills)
          VALUES ($1, $2, $3, $4::jsonb)
          ON CONFLICT (user_id)
          DO UPDATE SET
            display_name = EXCLUDED.display_name,
            biography = EXCLUDED.biography,
            skills = EXCLUDED.skills,
            updated_at = now()
          RETURNING
            biography,
            display_name,
            $5::wb_locale AS preferred_locale,
            skills
        `,
        [userId, input.displayName, input.biography, JSON.stringify(input.skills), input.locale],
      );

      await client.query(
        `
          INSERT INTO identity_audit_events (actor_user_id, event_type, metadata)
          VALUES ($1, 'profile.updated', $2::jsonb)
        `,
        [userId, JSON.stringify({ fields: ['biography', 'displayName', 'locale', 'skills'] })],
      );

      const profile = profileResult.rows[0];

      if (profile === undefined) {
        throw new Error('Profile upsert did not return a row.');
      }

      return this.toPrivateProfile(profile);
    });
  }

  private async ensureUser(
    client: DatabaseClient,
    identity: AuthenticatedIdentity,
  ): Promise<string> {
    const existingIdentity = await client.query<{ user_id: string }>(
      `
        SELECT user_id
        FROM user_identities
        WHERE issuer = $1 AND subject = $2
        FOR UPDATE
      `,
      [identity.issuer, identity.subject],
    );
    const existingUserId = existingIdentity.rows[0]?.user_id;

    if (existingUserId !== undefined) {
      await client.query(
        `
          UPDATE user_identities
          SET last_authenticated_at = now()
          WHERE issuer = $1 AND subject = $2
        `,
        [identity.issuer, identity.subject],
      );
      return existingUserId;
    }

    const userResult = await client.query<{ id: string }>(
      'INSERT INTO users DEFAULT VALUES RETURNING id',
    );
    const userId = userResult.rows[0]?.id;

    if (userId === undefined) {
      throw new Error('User creation did not return an identifier.');
    }

    await client.query(
      `
        INSERT INTO user_identities (user_id, issuer, subject)
        VALUES ($1, $2, $3)
      `,
      [userId, identity.issuer, identity.subject],
    );

    return userId;
  }

  private toPrivateProfile(row: ProfileRow): PrivateProfile {
    if (row.preferred_locale !== 'ar' && row.preferred_locale !== 'en') {
      throw new Error('Profile locale is invalid.');
    }

    if (!Array.isArray(row.skills) || !row.skills.every((skill) => typeof skill === 'string')) {
      throw new Error('Profile skills are invalid.');
    }

    return Object.freeze({
      biography: row.biography,
      displayName: row.display_name,
      locale: row.preferred_locale,
      skills: Object.freeze([...row.skills]),
    });
  }
}
