import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'demo@lifepilot.app' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @ApiProperty({ example: 'Abcd1234', minLength: 8 })
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(72)
  @Matches(/[A-Za-z]/, { message: '密码需包含字母' })
  @Matches(/\d/, { message: '密码需包含数字' })
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'demo@lifepilot.app' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @ApiProperty({ example: 'Abcd1234' })
  @MinLength(1, { message: '请输入密码' })
  password!: string;
}

export class AuthResponseDto {
  accessToken!: string;
  user!: { id: string; email: string; timezone: string };
}
