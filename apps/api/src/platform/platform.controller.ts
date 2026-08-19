import {
  Body,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { AuthenticatedIdentity, RequestWithIdentity } from '../identity/identity-context.js';
import { PlatformAuthenticationGuard } from '../identity/platform-authentication.guard.js';
import { PlatformService } from './platform.service.js';
import type { InputRecord } from './platform.service.js';

function asRecord(value: unknown): InputRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return Object.freeze({});
  }

  return Object.freeze({ ...(value as Record<string, unknown>) });
}

@Controller('v1')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get('platform/home')
  async getHome() {
    return this.platform.getHome();
  }

  @Get('communities')
  async getCommunities() {
    return this.platform.listCommunities();
  }

  @Post('communities')
  @UseGuards(PlatformAuthenticationGuard)
  async createCommunity(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.createCommunity(this.identity(request), asRecord(body));
  }

  @Post('communities/:slug/join')
  @UseGuards(PlatformAuthenticationGuard)
  async joinCommunity(@Param('slug') slug: string, @Req() request: RequestWithIdentity) {
    return this.platform.joinCommunity(this.identity(request), slug);
  }

  @Get('discussions')
  async getDiscussions() {
    return this.platform.listDiscussions();
  }

  @Post('discussions')
  @UseGuards(PlatformAuthenticationGuard)
  async createDiscussion(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.createDiscussion(this.identity(request), asRecord(body));
  }

  @Post('discussions/:id/reactions')
  @UseGuards(PlatformAuthenticationGuard)
  async reactToDiscussion(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.platform.reactToDiscussion(this.identity(request), id);
  }

  @Get('events')
  async getEvents() {
    return this.platform.listEvents();
  }

  @Post('events')
  @UseGuards(PlatformAuthenticationGuard)
  async createEvent(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.createEvent(this.identity(request), asRecord(body));
  }

  @Post('events/:id/register')
  @UseGuards(PlatformAuthenticationGuard)
  async registerForEvent(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.platform.registerForEvent(this.identity(request), id);
  }

  @Get('opportunities')
  async getOpportunities() {
    return this.platform.listOpportunities();
  }

  @Get('services')
  async getServices() {
    return this.platform.listServices();
  }

  @Post('services/:id/requests')
  @UseGuards(PlatformAuthenticationGuard)
  async requestService(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: RequestWithIdentity,
  ) {
    return this.platform.requestService(this.identity(request), id, asRecord(body));
  }

  @Get('me/notifications')
  @UseGuards(PlatformAuthenticationGuard)
  async getNotifications(@Req() request: RequestWithIdentity) {
    return this.platform.listNotifications(this.identity(request));
  }

  @Post('reports')
  @UseGuards(PlatformAuthenticationGuard)
  async submitReport(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.submitReport(this.identity(request), asRecord(body));
  }

  @Get('me/recommendations')
  @UseGuards(PlatformAuthenticationGuard)
  async getRecommendations(@Req() request: RequestWithIdentity) {
    return this.platform.getRecommendations(this.identity(request));
  }

  @Post('ai/tasks')
  @UseGuards(PlatformAuthenticationGuard)
  async createAiTask(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.createAiTask(this.identity(request), asRecord(body));
  }

  @Post('workflows')
  @UseGuards(PlatformAuthenticationGuard)
  async createWorkflow(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.createWorkflow(this.identity(request), asRecord(body));
  }

  private identity(request: RequestWithIdentity): AuthenticatedIdentity {
    if (request.identity === undefined) {
      throw new InternalServerErrorException('The authenticated identity context is unavailable.');
    }

    return request.identity;
  }
}
