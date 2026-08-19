import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommunitiesModule } from '../communities/communities.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AuthModule, CommunitiesModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
