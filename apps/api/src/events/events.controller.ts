import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, EmailVerifiedGuard } from '../auth';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
@UseGuards(EmailVerifiedGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: any) { return this.events.list(user); }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) { return this.events.get(user, id); }

  @Post()
  create(@CurrentUser() user: any, @Body() body: { title: string; description?: string; startsAt: string; timezone?: string; zoomUrl: string; visibility: 'public' | 'private'; communityId?: string; groupId?: string }) {
    return this.events.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { title?: string; description?: string; startsAt?: string; timezone?: string; zoomUrl?: string; status?: 'published' | 'cancelled' | 'completed' }) {
    return this.events.update(user, id, body);
  }

  @Post(':id/register')
  register(@CurrentUser() user: any, @Param('id') id: string) { return this.events.register(user, id); }

  @Post(':id/cancel-registration')
  cancel(@CurrentUser() user: any, @Param('id') id: string) { return this.events.cancelRegistration(user, id); }
}
