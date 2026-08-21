import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, EmailVerifiedGuard } from '../auth';
import { ContentService } from './content.service';

@ApiTags('content')
@Controller()
@UseGuards(EmailVerifiedGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('feeds/:scopeType/:scopeId')
  list(@CurrentUser() user: any, @Param('scopeType') scopeType: 'community' | 'group', @Param('scopeId') scopeId: string) {
    return this.content.list(user, scopeType, scopeId);
  }

  @Post('feeds/:scopeType/:scopeId/posts')
  create(@CurrentUser() user: any, @Param('scopeType') scopeType: 'community' | 'group', @Param('scopeId') scopeId: string, @Body() body: { body: string }) {
    return this.content.create(user, scopeType, scopeId, body.body);
  }

  @Patch('posts/:id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { body: string }) { return this.content.update(user, id, body.body); }

  @Delete('posts/:id')
  remove(@CurrentUser() user: any, @Param('id') id: string) { return this.content.delete(user, id); }

  @Get('posts/:id/comments')
  comments(@CurrentUser() user: any, @Param('id') id: string) { return this.content.comments(user, id); }

  @Post('posts/:id/comments')
  comment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { body: string }) { return this.content.comment(user, id, body.body); }

  @Post('posts/:id/like')
  like(@CurrentUser() user: any, @Param('id') id: string) { return this.content.like(user, id); }

  @Delete('posts/:id/like')
  unlike(@CurrentUser() user: any, @Param('id') id: string) { return this.content.unlike(user, id); }

  @Post('reports')
  report(@CurrentUser() user: any, @Body() body: { targetType: 'post' | 'comment'; targetId: string; reason: string }) { return this.content.report(user, body); }

  @Get('moderation/reports')
  reports(@CurrentUser() user: any) { return this.content.reports(user); }

  @Post('moderation/actions')
  moderate(@CurrentUser() user: any, @Body() body: { reportId: string; targetType: 'post' | 'comment'; targetId: string; actionType: 'hide' | 'restore' | 'dismiss'; reason?: string }) { return this.content.moderate(user, body); }
}
