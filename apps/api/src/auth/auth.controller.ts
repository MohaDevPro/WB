import {
  Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser, SessionGuard } from './session.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: { email: string; password: string; phoneNumber: string; displayName: string }) {
    return this.auth.register(body);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(body.email, body.password);
    response.cookie('wk_session', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return { user: result.user };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.revokeSession(request.cookies?.wk_session as string | undefined);
    response.clearCookie('wk_session', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    return { success: true };
  }

  @Get('session')
  @UseGuards(SessionGuard)
  session(@CurrentUser() user: unknown) {
    return { user };
  }

  @Post('email/resend')
  @UseGuards(SessionGuard)
  async resend(@CurrentUser() user: { id: string; email: string }) {
    return this.auth.issueEmailVerification(user.id, user.email);
  }

  @Post('email/verify')
  verify(@Body() body: { token: string }) {
    return this.auth.verifyEmail(body.token);
  }

  @Post('password/forgot')
  forgot(@Body() body: { email: string }) {
    return this.auth.forgotPassword(body.email);
  }

  @Post('password/reset')
  reset(@Body() body: { token: string; password: string }) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Get('sessions')
  @UseGuards(SessionGuard)
  sessions(@CurrentUser() user: { id: string }) {
    return this.auth.listSessions(user.id);
  }

  @Delete('sessions/:id')
  @UseGuards(SessionGuard)
  revoke(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.auth.revokeSessionById(user.id, id);
  }
}
