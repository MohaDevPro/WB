import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { DatabaseService } from './database/database.service.js';
import { HealthController } from './health.controller.js';
import { AuthController } from './identity/auth.controller.js';
import { LocalAuthenticationService } from './identity/local-authentication.service.js';
import { OidcAuthenticationGuard } from './identity/oidc-authentication.guard.js';
import { PlatformAuthenticationGuard } from './identity/platform-authentication.guard.js';
import { ProfileController } from './profile/profile.controller.js';
import { ProfileService } from './profile/profile.service.js';
import { PlatformController } from './platform/platform.controller.js';
import { PlatformService } from './platform/platform.service.js';
import { apiRuntimeConfigProvider } from './runtime-config.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        limit: 60,
        ttl: 60_000,
      },
    ]),
  ],
  controllers: [HealthController, AuthController, ProfileController, PlatformController],
  providers: [
    apiRuntimeConfigProvider,
    DatabaseService,
    OidcAuthenticationGuard,
    LocalAuthenticationService,
    PlatformAuthenticationGuard,
    ProfileService,
    PlatformService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
