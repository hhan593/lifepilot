import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface UserSummary {
  id: string;
  email: string;
  timezone: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('该邮箱已注册');

    const passwordHash = await hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        settings: { create: {} },
      },
    });
    return this.issueTokens(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('邮箱或密码错误');

    const ok = await verify(user.passwordHash, dto.password).catch(() => false);
    if (!ok) throw new UnauthorizedException('邮箱或密码错误');

    return this.issueTokens(user.id, user.email);
  }

  /** 刷新令牌旋转：旧令牌作废并签发新的一对 */
  async refresh(rawToken: string): Promise<AuthResult> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.sha256(rawToken) },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(record.user.id, record.user.email);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, email: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, timezone: true },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ??
          '15m') as JwtSignOptions['expiresIn'],
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS') ?? 30;
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.sha256(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });

    return { accessToken, refreshToken, user };
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
