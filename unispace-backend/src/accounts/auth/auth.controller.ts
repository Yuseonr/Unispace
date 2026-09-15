import { Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

function refreshTokenFrom(request: Request) {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }

  const refreshToken = (cookies as Record<string, unknown>)[
    REFRESH_TOKEN_COOKIE
  ];
  return typeof refreshToken === 'string' ? refreshToken : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }

  @Public()
  @Post('login')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.login(input.email, input.password);
    this.setRefreshCookie(response, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.refresh(refreshTokenFrom(request) ?? '');
    this.setRefreshCookie(response, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(refreshTokenFrom(request));
    response.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions());
    return { loggedOut: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Patch('password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.changePassword(
      user.id,
      input.currentPassword,
      input.newPassword,
    );
    this.setRefreshCookie(response, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    const refreshExpiresIn = this.config.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const match = /^(\d+)([smhd])$/.exec(refreshExpiresIn);
    if (!match) {
      throw new Error('JWT_REFRESH_EXPIRES_IN must use s, m, h, or d');
    }

    const milliseconds = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('APP_ENV') === 'production',
      path: '/api/v1/auth',
      maxAge:
        Number(match[1]) * milliseconds[match[2] as keyof typeof milliseconds],
    };
  }
}
