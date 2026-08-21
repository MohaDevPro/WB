import { Injectable, NotFoundException } from '@nestjs/common';
import { query } from '../common/db';

@Injectable()
export class ProfilesService {
  async get(userId: string) {
    const result = await query<Record<string, unknown>>(
      `SELECT u.id, u.email, ph.phone_e164, u.email_verified_at, p.display_name, p.avatar_object_key, p.bio
       FROM auth.users u
       LEFT JOIN auth.user_phones ph ON ph.user_id = u.id
       LEFT JOIN profile.profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    if (!result.rows[0]) throw new NotFoundException('Profile not found');
    const row = result.rows[0];
    return {
      id: String(row.id),
      email: String(row.email),
      phoneNumber: String(row.phone_e164 ?? ''),
      displayName: String(row.display_name ?? ''),
      emailVerifiedAt: row.email_verified_at,
      avatarObjectKey: row.avatar_object_key,
      bio: row.bio,
    };
  }

  async update(userId: string, input: { displayName?: string; bio?: string; avatarObjectKey?: string | null }) {
    const current = await this.get(userId);
    const displayName = input.displayName?.trim() || current.displayName;
    const bio = input.bio === undefined ? String(current.bio ?? '') : input.bio.trim();
    if (bio && bio.length > 500) throw new Error('Bio must be 500 characters or fewer');
    await query(
      `INSERT INTO profile.profiles (user_id, display_name, bio, avatar_object_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, bio = EXCLUDED.bio, avatar_object_key = COALESCE(EXCLUDED.avatar_object_key, profile.profiles.avatar_object_key), updated_at = now()`,
      [userId, displayName, bio, input.avatarObjectKey ?? null],
    );
    return this.get(userId);
  }
}
