import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { AuthService, PublicUser } from './auth.service';

type AuthenticatedRequest = Request & { user?: PublicUser; sessionToken?: string };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.wb_session as string | undefined;
    const user = await this.auth.getUserBySession(token);
    if (!user) throw new UnauthorizedException('Authentication required');
    request.user = user;
    request.sessionToken = token;
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user as PublicUser;
});
