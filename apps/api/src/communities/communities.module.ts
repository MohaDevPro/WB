import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemModule } from '../system/system.module';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';

@Module({
  imports: [AuthModule, SystemModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
