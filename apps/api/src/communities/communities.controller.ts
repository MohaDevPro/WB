import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, EmailVerifiedGuard } from '../auth';
import { CommunitiesService } from './communities.service';

@ApiTags('communities')
@Controller()
@UseGuards(EmailVerifiedGuard)
export class CommunitiesController {
  constructor(private readonly communities: CommunitiesService) {}

  @Get('communities')
  list(@CurrentUser() user: any) { return this.communities.list(user); }

  @Get('communities/:id')
  get(@CurrentUser() user: any, @Param('id') id: string) { return this.communities.get(user, id); }

  @Post('communities/:id/join')
  join(@CurrentUser() user: any, @Param('id') id: string) { return this.communities.join(user, id); }

  @Get('communities/:id/membership')
  membership(@CurrentUser() user: any, @Param('id') id: string) { return this.communities.membership(user, id); }

  @Get('communities/:id/groups')
  groups(@CurrentUser() user: any, @Param('id') id: string) { return this.communities.groups(user, id); }

  @Get('admin/communities/:id/membership-requests')
  requests(@CurrentUser() user: any, @Param('id') id: string) { return this.communities.membershipRequests(user, id); }

  @Post('admin/membership-requests/:id/approve')
  approve(@CurrentUser() user: any, @Param('id') id: string) { return this.communities.decideMembership(user, id, 'approved'); }

  @Post('admin/membership-requests/:id/reject')
  reject(@CurrentUser() user: any, @Param('id') id: string) { return this.communities.decideMembership(user, id, 'rejected'); }

  @Post('admin/communities')
  createCommunity(@CurrentUser() user: any, @Body() body: { name: string; slug: string; description: string; visibility: 'public' | 'closed' }) {
    return this.communities.createCommunity(user, body);
  }

  @Post('admin/communities/:id/groups')
  createGroup(@CurrentUser() user: any, @Param('id') communityId: string, @Body() body: { name: string; description: string }) {
    return this.communities.createGroup(user, communityId, body);
  }

  @Post('admin/groups/:id/moderators')
  assignModerator(@CurrentUser() user: any, @Param('id') groupId: string, @Body() body: { userId: string }) {
    return this.communities.assignModerator(user, groupId, body.userId);
  }
}
