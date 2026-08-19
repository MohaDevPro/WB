import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ApiRuntimeConfig } from '@wb/config';

import { DatabaseService } from '../database/database.service.js';
import type { DatabaseClient } from '../database/database.types.js';
import { API_RUNTIME_CONFIG } from '../runtime-config.js';
import type { AuthenticatedIdentity } from './identity-context.js';

const scrypt = promisify(scryptCallback);
const localIssuer = 'wb-local';
const sessionLifetimeMilliseconds = 1000 * 60 * 60 * 12;

type AccountRow = Readonly<{
  email: string;
  password_hash: string;
  user_id: string;
}>;

type SessionRow = Readonly<{
  expires_at: Date | string;
  user_id: string;
}>;

export type LocalSession = Readonly<{
  accessToken: string;
  expiresAt: string;
  identity: AuthenticatedIdentity;
}>;

function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) && value.length <= 254;
}

async function hashPassword(password: string, suppliedSalt?: string): Promise<string> {
  const salt = suppliedSalt ?? randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function passwordMatches(password: string, encodedHash: string): Promise<boolean> {
  const [salt, expectedHash] = encodedHash.split(':', 2);

  if (salt === undefined || expectedHash === undefined) {
    return false;
  }

  const actualHash = await hashPassword(password, salt);
  const actualValue = Buffer.from(actualHash.split(':', 2)[1] ?? '', 'hex');
  const expectedValue = Buffer.from(expectedHash, 'hex');

  return actualValue.length === expectedValue.length && timingSafeEqual(actualValue, expectedValue);
}

function hashToken(token: string): string {
  return Buffer.from(token).toString('base64url');
}

@Injectable()
export class LocalAuthenticationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(API_RUNTIME_CONFIG) private readonly configuration: ApiRuntimeConfig,
  ) {}

  async register(emailInput: string, password: string): Promise<LocalSession> {
    this.assertEnabled();
    const email = normalizeEmail(emailInput);
    this.assertCredentials(email, password);

    return this.database.withTransaction(async (client) => {
      const existing = await client.query<{ user_id: string }>(
        'SELECT user_id FROM local_accounts WHERE email = $1',
        [email],
      );

      if (existing.rowCount !== 0) {
        throw new ConflictException('An account with this email already exists.');
      }

      const userResult = await client.query<{ id: string }>(
        'INSERT INTO users DEFAULT VALUES RETURNING id',
      );
      const userId = userResult.rows[0]?.id;

      if (userId === undefined) {
        throw new Error('User creation did not return an identifier.');
      }

      await client.query(
        'INSERT INTO user_identities (user_id, issuer, subject) VALUES ($1, $2, $3)',
        [userId, localIssuer, userId],
      );
      await client.query(
        'INSERT INTO local_accounts (user_id, email, password_hash, is_email_verified) VALUES ($1, $2, $3, TRUE)',
        [userId, email, await hashPassword(password)],
      );
      await client.query('INSERT INTO platform_roles (user_id, role) VALUES ($1, $2)', [
        userId,
        'member',
      ]);
      await client.query('INSERT INTO notification_preferences (user_id) VALUES ($1)', [userId]);
      await client.query(
        "INSERT INTO platform_audit_events (actor_user_id, event_type, resource_type, resource_id) VALUES ($1, 'identity.registered', 'user', $1)",
        [userId],
      );

      return this.createSession(userId, client);
    });
  }

  async login(emailInput: string, password: string): Promise<LocalSession> {
    this.assertEnabled();
    const email = normalizeEmail(emailInput);
    this.assertCredentials(email, password);

    return this.database.withTransaction(async (client) => {
      const account = await client.query<AccountRow>(
        'SELECT user_id, email, password_hash FROM local_accounts WHERE email = $1 FOR UPDATE',
        [email],
      );
      const row = account.rows[0];

      if (row === undefined || !(await passwordMatches(password, row.password_hash))) {
        throw new UnauthorizedException('Email or password is invalid.');
      }

      await client.query(
        "INSERT INTO platform_audit_events (actor_user_id, event_type, resource_type, resource_id) VALUES ($1, 'identity.logged_in', 'user', $1)",
        [row.user_id],
      );

      return this.createSession(row.user_id, client);
    });
  }

  async authenticate(accessToken: string): Promise<AuthenticatedIdentity | undefined> {
    if (this.configuration.nodeEnv === 'production') {
      return undefined;
    }

    const session = await this.database.query<SessionRow>(
      `
        SELECT user_id, expires_at
        FROM sessions
        WHERE token_hash = $1 AND revoked_at IS NULL
        LIMIT 1
      `,
      [hashToken(accessToken)],
    );
    const row = session.rows[0];

    if (row === undefined || new Date(row.expires_at).getTime() <= Date.now()) {
      return undefined;
    }

    return Object.freeze({ issuer: localIssuer, subject: row.user_id });
  }

  async revoke(accessToken: string): Promise<void> {
    await this.database.query(
      'UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
      [hashToken(accessToken)],
    );
  }

  private assertEnabled(): void {
    if (this.configuration.nodeEnv === 'production') {
      throw new ServiceUnavailableException(
        'Local development authentication is disabled in production.',
      );
    }
  }

  private assertCredentials(email: string, password: string): void {
    if (!isValidEmail(email)) {
      throw new UnauthorizedException('A valid email address is required.');
    }

    if (password.length < 12 || password.length > 128) {
      throw new UnauthorizedException('Password length must be between 12 and 128 characters.');
    }
  }

  private async createSession(userId: string, client: DatabaseClient): Promise<LocalSession> {
    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + sessionLifetimeMilliseconds);

    await client.query(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [randomUUID(), userId, hashToken(accessToken), expiresAt.toISOString()],
    );

    return Object.freeze({
      accessToken,
      expiresAt: expiresAt.toISOString(),
      identity: Object.freeze({ issuer: localIssuer, subject: userId }),
    });
  }
}
