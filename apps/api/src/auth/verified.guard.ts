import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SessionGuard } from './session.guard';
import { PublicUser } from './auth.service';

type AuthenticatedRequest = Request & { user?: PublicUser };

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly session: SessionGuard) {}

  async canActivate(context: ExecutionContext) {
    const allowed = await this.session.canActivate(context);
    if (!allowed) return false;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.emailVerifiedAt) throw new ForbiddenException('Verify your email before using WK');
    return true;
  }
}
