import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditService } from './audit.service';

@Module({
  imports: [NotificationsModule],
  providers: [AuditService],
  exports: [AuditService, NotificationsModule],
})
export class SystemModule {}
