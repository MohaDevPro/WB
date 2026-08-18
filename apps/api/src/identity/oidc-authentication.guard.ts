import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { ApiRuntimeConfig } from '@wb/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import { API_RUNTIME_CONFIG } from '../runtime-config.js';
import { getBearerToken, type RequestWithIdentity } from './identity-context.js';

@Injectable()
export class OidcAuthenticationGuard implements CanActivate {
  private verificationKey: JWTVerifyGetKey | undefined;

  constructor(@Inject(API_RUNTIME_CONFIG) private readonly configuration: ApiRuntimeConfig) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const oidc = this.configuration.oidc;

    if (oidc === undefined) {
      throw new ServiceUnavailableException('Identity authentication is not configured.');
    }

    const request = context.switchToHttp().getRequest<RequestWithIdentity>();
    const token = getBearerToken(request.headers.authorization);

    if (token === undefined) {
      throw new UnauthorizedException('A bearer access token is required.');
    }

    try {
      this.verificationKey ??= createRemoteJWKSet(oidc.jwksUri);
      const { payload } = await jwtVerify(token, this.verificationKey, {
        audience: oidc.audience,
        issuer: oidc.issuer.toString(),
      });

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new UnauthorizedException('The access token does not contain a subject.');
      }

      request.identity = Object.freeze({
        issuer: oidc.issuer.toString(),
        subject: payload.sub,
      });

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('The bearer access token is invalid.');
    }
  }
}
