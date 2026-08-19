import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { getBearerToken } from './identity-context.js';
import type { RequestWithIdentity } from './identity-context.js';
import { LocalAuthenticationService } from './local-authentication.service.js';
import type { LocalSession } from './local-authentication.service.js';
import { PlatformAuthenticationGuard } from './platform-authentication.guard.js';

type CredentialsInput = Readonly<{
  email: string;
  password: string;
}>;

type CurrentUser = Readonly<{
  email: string;
  id: string;
  roles: readonly string[];
}>;

function parseCredentials(value: unknown): CredentialsInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('Credentials must be an object.');
  }

  const { email, password } = value as Record<string, unknown>;

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new BadRequestException('Email and password are required.');
  }

  return Object.freeze({ email, password });
}

@Controller('v1/auth')
export class AuthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(LocalAuthenticationService)
    private readonly localAuthentication: LocalAuthenticationService,
  ) {}

  @Post('register')
  async register(@Body() body: unknown): Promise<LocalSession> {
    const credentials = parseCredentials(body);
    return this.localAuthentication.register(credentials.email, credentials.password);
  }

  @Post('login')
  async login(@Body() body: unknown): Promise<LocalSession> {
    const credentials = parseCredentials(body);
    return this.localAuthentication.login(credentials.email, credentials.password);
  }

  @Post('logout')
  @UseGuards(PlatformAuthenticationGuard)
  async logout(@Req() request: RequestWithIdentity): Promise<Readonly<{ revoked: true }>> {
    const token = getBearerToken(request.headers.authorization);

    if (token === undefined) {
      throw new UnauthorizedException('A bearer access token is required.');
    }

    await this.localAuthentication.revoke(token);
    return Object.freeze({ revoked: true });
  }

  @Get('me')
  @UseGuards(PlatformAuthenticationGuard)
  async getCurrentUser(@Req() request: RequestWithIdentity): Promise<CurrentUser> {
    if (request.identity === undefined) {
      throw new UnauthorizedException('An authenticated identity is required.');
    }

    const user = await this.database.query<{ email: string; id: string }>(
      `
        SELECT users.id, local_accounts.email
        FROM users
        LEFT JOIN local_accounts ON local_accounts.user_id = users.id
        INNER JOIN user_identities ON user_identities.user_id = users.id
        WHERE user_identities.issuer = $1 AND user_identities.subject = $2
        LIMIT 1
      `,
      [request.identity.issuer, request.identity.subject],
    );
    const row = user.rows[0];

    if (row === undefined) {
      throw new UnauthorizedException('The authenticated account is unavailable.');
    }

    const roles = await this.database.query<{ role: string }>(
      'SELECT role FROM platform_roles WHERE user_id = $1 ORDER BY role',
      [row.id],
    );

    return Object.freeze({
      email: row.email,
      id: row.id,
      roles: Object.freeze(roles.rows.map((role) => role.role)),
    });
  }
}
