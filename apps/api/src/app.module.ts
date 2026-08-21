import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CommunitiesModule } from './communities/communities.module';
import { ContentModule } from './content/content.module';
import { EventsModule } from './events/events.module';
import { ProfilesModule } from './profiles/profiles.module';
import { HealthController } from './common/health.controller';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [AuthModule, ProfilesModule, CommunitiesModule, ContentModule, EventsModule, NotificationsModule],
  controllers: [HealthController],
})
export class AppModule {}
