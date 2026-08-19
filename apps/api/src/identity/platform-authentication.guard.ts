import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { ApiRuntimeConfig } from '@wb/config';

import { API_RUNTIME_CONFIG } from '../runtime-config.js';
import { getBearerToken } from './identity-context.js';
import type { RequestWithIdentity } from './identity-context.js';
import { LocalAuthenticationService } from './local-authentication.service.js';
import { OidcAuthenticationGuard } from './oidc-authentication.guard.js';

@Injectable()
export class PlatformAuthenticationGuard implements CanActivate {
  constructor(
    @Inject(LocalAuthenticationService)
    private readonly localAuthentication: LocalAuthenticationService,
    @Inject(OidcAuthenticationGuard)
    private readonly oidcAuthentication: OidcAuthenticationGuard,
    @Inject(API_RUNTIME_CONFIG) private readonly configuration: ApiRuntimeConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithIdentity>();
    const token = getBearerToken(request.headers.authorization);

    if (token === undefined) {
      throw new UnauthorizedException('A bearer access token is required.');
    }

    const localIdentity = await this.localAuthentication.authenticate(token);

    if (localIdentity !== undefined) {
      request.identity = localIdentity;
      return true;
    }

    if (this.configuration.oidc !== undefined) {
      return this.oidcAuthentication.canActivate(context);
    }

    throw new UnauthorizedException('The bearer access token is invalid or expired.');
  }
}
