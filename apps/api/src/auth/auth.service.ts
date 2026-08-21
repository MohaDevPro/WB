import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Resend } from 'resend';
import { dbUser, query, transaction } from '../common/db';
import { isValidPassword, isValidPhone } from '../common/v0-rules';

export type PublicUser = {
  id: string;
  email: string;
  phoneNumber: string;
  displayName: string;
  platformRole: string;
  emailVerifiedAt: string | null;
  status: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  async register(input: { email: string; password: string; phoneNumber: string; displayName: string }) {
    const details = validateRegistration(input);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.createUser(details, passwordHash);
    await this.issueEmailVerification(user, details.email);
    return { message: 'Account created. Check your email to activate it.' };
  }

  private async createUser(details: RegistrationDetails, passwordHash: string) {
    return transaction(async (client) => {
      try {
        const result = await client.query<{ id: string }>(
          `INSERT INTO auth.users (email, password_hash)
           VALUES ($1, $2) RETURNING id`,
          [details.email, passwordHash],
        );
        const userId = result.rows[0].id;
        await client.query('INSERT INTO auth.user_phones (user_id, phone_e164) VALUES ($1, $2)', [userId, details.phoneNumber]);
        await client.query('INSERT INTO profile.profiles (user_id, display_name) VALUES ($1, $2)', [userId, details.displayName]);
        return userId;
      } catch (error: any) {
        if (error.code === '23505') throw new BadRequestException('An account with this email or phone already exists');
        throw error;
      }
    });
  }

  async login(emailInput: string, password: string) {
    const row = await this.findLoginUser(normalizeEmail(emailInput));
    if (!(await credentialsMatch(row, password))) {
      await this.recordLoginFailure(row);
      throw new UnauthorizedException('Invalid email or password');
    }
    assertActiveAccount(row);
    await this.recordLoginSuccess(String(row.id));
    return { user: dbUser(row) as PublicUser, token: await this.createSession(String(row.id)) };
  }

  private async findLoginUser(email: string) {
    const result = await query<Record<string, unknown>>(
      `SELECT u.*, ph.phone_e164, p.display_name
       FROM auth.users u
       LEFT JOIN auth.user_phones ph ON ph.user_id = u.id
       LEFT JOIN profile.profiles p ON p.user_id = u.id
       WHERE u.email = $1 LIMIT 1`,
      [email],
    );
    return result.rows[0];
  }

  private async recordLoginFailure(row: Record<string, unknown> | undefined) {
    await query('INSERT INTO auth.security_events (user_id, event_type) VALUES ($1, $2)', [row?.id ?? null, 'login_failed']);
  }

  private async recordLoginSuccess(userId: string) {
    await query('INSERT INTO auth.security_events (user_id, event_type) VALUES ($1, $2)', [userId, 'login_succeeded']);
  }

  async createSession(userId: string) {
    const token = randomBytes(32).toString('base64url');
    await query(
      `INSERT INTO auth.sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
      [userId, hashToken(token)],
    );
    return token;
  }

  async getUserBySession(token: string | undefined): Promise<PublicUser | null> {
    if (!token) return null;
    const result = await query<Record<string, unknown>>(
      `SELECT u.*, ph.phone_e164, p.display_name FROM auth.sessions s
       JOIN auth.users u ON u.id = s.user_id
       LEFT JOIN auth.user_phones ph ON ph.user_id = u.id
       LEFT JOIN profile.profiles p ON p.user_id = u.id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'`,
      [hashToken(token)],
    );
    return result.rows[0] ? (dbUser(result.rows[0]) as PublicUser) : null;
  }

  async revokeSession(token: string | undefined) {
    if (!token) return;
    await query('UPDATE auth.sessions SET revoked_at = now() WHERE token_hash = $1', [hashToken(token)]);
  }

  async listSessions(userId: string) {
    const result = await query<{ id: string; created_at: string; expires_at: string; revoked_at: string | null }>(
      `SELECT id, created_at, expires_at, revoked_at FROM auth.sessions WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async revokeSessionById(userId: string, sessionId: string) {
    await query('UPDATE auth.sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2', [sessionId, userId]);
    await query('INSERT INTO auth.security_events (user_id, event_type) VALUES ($1, $2)', [userId, 'session_revoked']);
    return { success: true };
  }

  async verifyEmail(token: string) {
    const tokenHash = hashToken(token);
    const result = await transaction(async (client) => {
      const found = await client.query<{ id: string; user_id: string; email: string }>(
        `SELECT e.id, e.user_id, u.email FROM auth.email_verification_tokens e JOIN auth.users u ON u.id = e.user_id
         WHERE e.token_hash = $1 AND e.used_at IS NULL AND e.expires_at > now() FOR UPDATE`,
        [tokenHash],
      );
      if (!found.rows[0]) throw new BadRequestException('Verification link is invalid or expired');
      await client.query('UPDATE auth.email_verification_tokens SET used_at = now() WHERE id = $1', [found.rows[0].id]);
      await client.query('UPDATE auth.users SET email_verified_at = now(), updated_at = now() WHERE id = $1', [found.rows[0].user_id]);
      await client.query('INSERT INTO auth.security_events (user_id, event_type) VALUES ($1, $2)', [found.rows[0].user_id, 'email_verified']);
      return found.rows[0];
    });
    return { message: `Email ${result.email} verified successfully` };
  }

  async issueEmailVerification(userId: string, email: string) {
    const token = await this.createEmailVerificationToken(userId);
    const url = verificationUrl(token);
    this.logDevelopmentLink(url);
    await this.sendEmail(email, 'Activate your WB account', `<p>Activate your account: <a href="${url}">Verify email</a></p>`);
    return { message: 'Verification email sent' };
  }

  private async createEmailVerificationToken(userId: string) {
    await query('UPDATE auth.email_verification_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    const token = randomBytes(32).toString('base64url');
    await query(
      `INSERT INTO auth.email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '24 hours')`,
      [userId, hashToken(token)],
    );
    return token;
  }

  private logDevelopmentLink(url: string) {
    if (!this.resend && process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'console') console.info(`[mail:development:url] ${url}`);
  }

  async forgotPassword(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await this.findUserForReset(email);
    if (!user) return genericResetResponse();
    await this.sendPasswordResetEmail(user.id, email);
    return genericResetResponse();
  }

  private async findUserForReset(email: string) {
    const result = await query<{ id: string }>('SELECT id FROM auth.users WHERE email = $1 LIMIT 1', [email]);
    return result.rows[0];
  }

  private async sendPasswordResetEmail(userId: string, email: string) {
    const token = randomBytes(32).toString('base64url');
    await query('UPDATE auth.password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    await query(
      `INSERT INTO auth.password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
      [userId, hashToken(token)],
    );
    const url = resetPasswordUrl(token);
    this.logDevelopmentLink(url);
    await this.sendEmail(email, 'Reset your WB password', `<p>Reset your password: <a href="${url}">Reset password</a></p>`);
  }

  async resetPassword(token: string, password: string) {
    if (!isValidPassword(password)) throw new BadRequestException('Password must be at least 10 characters');
    const hash = await bcrypt.hash(password, 12);
    const result = await transaction(async (client) => {
      const found = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM auth.password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
        [hashToken(token)],
      );
      if (!found.rows[0]) throw new BadRequestException('Reset link is invalid or expired');
      await client.query('UPDATE auth.users SET password_hash = $1, updated_at = now() WHERE id = $2', [hash, found.rows[0].user_id]);
      await client.query('UPDATE auth.password_reset_tokens SET used_at = now() WHERE id = $1', [found.rows[0].id]);
      await client.query('UPDATE auth.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [found.rows[0].user_id]);
      return found.rows[0];
    });
    await query('INSERT INTO auth.security_events (user_id, event_type) VALUES ($1, $2)', [result.user_id, 'password_reset']);
    return { message: 'Password reset successfully' };
  }

  private async sendEmail(to: string, subject: string, html: string) {
    if (this.resend && process.env.RESEND_FROM) {
      const { error } = await this.resend.emails.send({ from: process.env.RESEND_FROM, to, subject, html });
      if (error) throw new BadRequestException('Email provider rejected the message');
      return;
    }
    if (process.env.NODE_ENV === 'production') throw new Error('Email provider is not configured');
    console.info(`[mail:development] ${subject} -> ${to}`);
  }
}

type RegistrationDetails = {
  email: string;
  phoneNumber: string;
  displayName: string;
};

function validateRegistration(input: { email: string; password: string; phoneNumber: string; displayName: string }): RegistrationDetails {
  const email = normalizeEmail(input.email);
  const phoneNumber = input.phoneNumber.trim();
  const displayName = input.displayName.trim();
  if (!isValidPassword(input.password)) throw new BadRequestException('Password must be at least 10 characters');
  if (!isValidPhone(phoneNumber)) throw new BadRequestException('Phone number must use E.164 format');
  if (!displayName) throw new BadRequestException('Display name is required');
  return { email, phoneNumber, displayName };
}

async function credentialsMatch(row: Record<string, unknown> | undefined, password: string) {
  return row ? bcrypt.compare(password, String(row.password_hash)) : false;
}

function assertActiveAccount(row: Record<string, unknown>) {
  if (row.status !== 'active') throw new UnauthorizedException('Account is not active');
}

function genericResetResponse() {
  return { message: 'If the account exists, a reset email will be sent.' };
}

function verificationUrl(token: string) {
  return `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/verify-email?token=${encodeURIComponent(token)}`;
}

function resetPasswordUrl(token: string) {
  return `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`;
}
