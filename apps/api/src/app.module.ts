import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { DatabaseService } from './database/database.service.js';
import { HealthController } from './health.controller.js';
import { OidcAuthenticationGuard } from './identity/oidc-authentication.guard.js';
import { ProfileController } from './profile/profile.controller.js';
import { ProfileService } from './profile/profile.service.js';
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
  controllers: [HealthController, ProfileController],
  providers: [
    apiRuntimeConfigProvider,
    DatabaseService,
    OidcAuthenticationGuard,
    ProfileService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
