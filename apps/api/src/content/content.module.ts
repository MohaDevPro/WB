import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommunitiesModule } from '../communities/communities.module';
import { SystemModule } from '../system/system.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [AuthModule, CommunitiesModule, SystemModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
