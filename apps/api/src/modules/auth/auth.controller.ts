import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService, AuthResult } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const REFRESH_COOKIE = 'lp_rt';
const REFRESH_MAX_AGE = 30 * 86_400_000;

export class RefreshDto {
  /** 原生客户端把 refresh token 放在 body 里；Web 端走 httpOnly Cookie */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.register(dto).then((result) => this.respond(res, result));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto).then((result) => this.respond(res, result));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto, @Res({ passthrough: true }) res: Response) {
    const raw = dto.refreshToken ?? (res.req.cookies?.[REFRESH_COOKIE] as string | undefined);
    return this.authService.refresh(raw ?? '').then((result) => this.respond(res, result));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto, @Res({ passthrough: true }) res: Response): Promise<void> {
    const raw = dto.refreshToken ?? (res.req.cookies?.[REFRESH_COOKIE] as string | undefined);
    await this.authService.logout(raw);
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), maxAge: 0 });
  }

  /** 响应体附带 refreshToken 供原生客户端持久化；Web 端仍以 httpOnly Cookie 为准（响应体字段被忽略） */
  private respond(res: Response, result: AuthResult) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, { ...this.cookieOptions(), maxAge: REFRESH_MAX_AGE });
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/api/v1/auth',
    };
  }
}
