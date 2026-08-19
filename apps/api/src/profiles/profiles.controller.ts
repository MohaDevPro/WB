import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { ProfilesService } from './profiles.service';

@ApiTags('profile')
@Controller('me/profile')
@UseGuards(SessionGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  get(@CurrentUser() user: { id: string }) {
    return this.profiles.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: { id: string }, @Body() body: { displayName?: string; bio?: string; avatarObjectKey?: string | null }) {
    return this.profiles.update(user.id, body);
  }
}
