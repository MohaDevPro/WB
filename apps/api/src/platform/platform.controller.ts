import {
  Body,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Param,
  Post,
  Put,
  Query,
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

  @Post('services')
  @UseGuards(PlatformAuthenticationGuard)
  async createService(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.createService(this.identity(request), asRecord(body));
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

  @Get('organizations')
  async getOrganizations() {
    return this.platform.listOrganizations();
  }

  @Post('organizations')
  @UseGuards(PlatformAuthenticationGuard)
  async createOrganization(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.createOrganization(this.identity(request), asRecord(body));
  }

  @Get('experts')
  async getExperts() {
    return this.platform.listExperts();
  }

  @Put('me/expert-profile')
  @UseGuards(PlatformAuthenticationGuard)
  async updateExpertProfile(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.updateExpertProfile(this.identity(request), asRecord(body));
  }

  @Get('learning-paths')
  async getLearningPaths() {
    return this.platform.listLearningPaths();
  }

  @Post('learning-paths')
  @UseGuards(PlatformAuthenticationGuard)
  async createLearningPath(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.createLearningPath(this.identity(request), asRecord(body));
  }

  @Post('learning-paths/:id/enrollments')
  @UseGuards(PlatformAuthenticationGuard)
  async enrollInLearningPath(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.platform.enrollInLearningPath(this.identity(request), id);
  }

  @Get('me/service-requests')
  @UseGuards(PlatformAuthenticationGuard)
  async getServiceRequests(@Req() request: RequestWithIdentity) {
    return this.platform.listServiceRequests(this.identity(request));
  }

  @Post('service-requests/:id/status')
  @UseGuards(PlatformAuthenticationGuard)
  async updateServiceRequestStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: RequestWithIdentity,
  ) {
    return this.platform.updateServiceRequestStatus(this.identity(request), id, asRecord(body));
  }

  @Post('service-requests/:id/payment-intents')
  @UseGuards(PlatformAuthenticationGuard)
  async createPaymentIntent(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: RequestWithIdentity,
  ) {
    return this.platform.createPaymentIntent(this.identity(request), id, asRecord(body));
  }

  @Post('payment-intents/:id/confirm')
  @UseGuards(PlatformAuthenticationGuard)
  async confirmPaymentIntent(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.platform.confirmPaymentIntent(this.identity(request), id);
  }

  @Get('me/payments')
  @UseGuards(PlatformAuthenticationGuard)
  async getPaymentIntents(@Req() request: RequestWithIdentity) {
    return this.platform.listPaymentIntents(this.identity(request));
  }

  @Get('services/:id/reviews')
  async getServiceReviews(@Param('id') id: string) {
    return this.platform.listServiceReviews(id);
  }

  @Post('reviews')
  @UseGuards(PlatformAuthenticationGuard)
  async createReview(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.createReview(this.identity(request), asRecord(body));
  }

  @Post('service-requests/:id/disputes')
  @UseGuards(PlatformAuthenticationGuard)
  async openServiceDispute(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: RequestWithIdentity,
  ) {
    return this.platform.openServiceDispute(this.identity(request), id, asRecord(body));
  }

  @Get('search')
  async search(@Query('q') query: string | undefined) {
    return this.platform.search(query ?? '');
  }

  @Post('assistant/messages')
  @UseGuards(PlatformAuthenticationGuard)
  async askAssistant(@Body() body: unknown, @Req() request: RequestWithIdentity) {
    return this.platform.askAssistant(this.identity(request), asRecord(body));
  }

  @Get('me/workflows')
  @UseGuards(PlatformAuthenticationGuard)
  async getWorkflows(@Req() request: RequestWithIdentity) {
    return this.platform.listWorkflows(this.identity(request));
  }

  @Post('workflows/:id/approve')
  @UseGuards(PlatformAuthenticationGuard)
  async approveWorkflow(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.platform.approveWorkflow(this.identity(request), id);
  }

  @Get('communities/:slug/federation-links')
  async getFederationLinks(@Param('slug') slug: string) {
    return this.platform.listFederationLinks(slug);
  }

  @Post('communities/:slug/federation-links')
  @UseGuards(PlatformAuthenticationGuard)
  async createFederationLink(
    @Param('slug') slug: string,
    @Body() body: unknown,
    @Req() request: RequestWithIdentity,
  ) {
    return this.platform.createFederationLink(this.identity(request), slug, asRecord(body));
  }

  @Post('me/notifications/:id/read')
  @UseGuards(PlatformAuthenticationGuard)
  async markNotificationRead(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.platform.markNotificationRead(this.identity(request), id);
  }

  private identity(request: RequestWithIdentity): AuthenticatedIdentity {
    if (request.identity === undefined) {
      throw new InternalServerErrorException('The authenticated identity context is unavailable.');
    }

    return request.identity;
  }
}
