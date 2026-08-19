import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { AuthenticatedIdentity, RequestWithIdentity } from '../identity/identity-context.js';
import { PlatformAuthenticationGuard } from '../identity/platform-authentication.guard.js';
import { parseProfileUpsertInput, ProfileValidationError } from './profile-input.js';
import { ProfileService } from './profile.service.js';
import type { PrivateProfile } from './profile.service.js';

@Controller('v1/me/profile')
@UseGuards(PlatformAuthenticationGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class ProfileController {
  constructor(@Inject(ProfileService) private readonly profileService: ProfileService) {}

  @Get()
  async getProfile(@Req() request: RequestWithIdentity): Promise<PrivateProfile> {
    return this.profileService.getPrivateProfile(this.getIdentity(request));
  }

  @Put()
  async upsertProfile(
    @Body() body: unknown,
    @Req() request: RequestWithIdentity,
  ): Promise<PrivateProfile> {
    try {
      const input = parseProfileUpsertInput(body);
      return await this.profileService.upsertPrivateProfile(this.getIdentity(request), input);
    } catch (error) {
      if (error instanceof ProfileValidationError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private getIdentity(request: RequestWithIdentity): AuthenticatedIdentity {
    if (request.identity === undefined) {
      throw new InternalServerErrorException('The authenticated identity context is unavailable.');
    }

    return request.identity;
  }
}
