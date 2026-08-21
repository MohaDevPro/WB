import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommunitiesModule } from '../communities/communities.module';
import { SystemModule } from '../system/system.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AuthModule, CommunitiesModule, SystemModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
