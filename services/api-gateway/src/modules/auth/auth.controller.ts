import { Controller, Post, Body, BadRequestException, UnauthorizedException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength, Matches, IsOptional } from 'class-validator';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

export class RegisterDto {
  @ApiProperty({ example: 'your@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '••••••••' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Alex' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Trader' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: '+254700123456', required: false })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'your@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '••••••••' })
  @IsString()
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'email', enum: ['email', 'phone'] })
  @IsString()
  @Matches(/^(email|phone)$/)
  method!: 'email' | 'phone';

  @ApiProperty({ example: 'your@email.com' })
  @IsString()
  @IsNotEmpty()
  inputValue!: string; // Email address or phone number
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'your@email.com' })
  @IsString()
  @IsNotEmpty()
  key!: string; // Email address or phone number

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  otp!: string;
}

export class CompleteTwoFactorDto {
  @ApiProperty({ example: 'your@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  otp!: string;
}

export class ResendOtpDto {
  @ApiProperty({ example: 'your@email.com' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: 'registration', enum: ['registration', 'password-reset', '2fa'] })
  @IsString()
  @Matches(/^(registration|password-reset|2fa)$/)
  purpose!: 'registration' | 'password-reset' | '2fa';

  @ApiProperty({ example: 'email', enum: ['email', 'phone'] })
  @IsString()
  @Matches(/^(email|phone)$/)
  channel!: 'email' | 'phone';
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'your@email.com' })
  @IsString()
  @IsNotEmpty()
  key!: string; // Email or phone verified key

  @ApiProperty({ example: '••••••••' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  async register(@Body() dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone?.trim();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      const code = this.authService.generateOtp();
      await this.authService.storeOtp(email, code, 'email');
      const delivery = await this.authService.sendEmailOtp(email, code);
      await this.authService.logOtpRequest(existingUser.id, 'REGISTRATION_RESEND', 'EMAIL', email);

      return {
        message: 'Account already exists. A fresh verification code has been sent so you can continue.',
        email,
        accountExists: true,
        deliveryMode: delivery.mode,
        devOtp: delivery.devOtp,
      };
    }

    // 1. Create User in PostgreSQL (in transaction)
    const user = await this.authService.registerUser(email, dto.password, dto.firstName.trim(), dto.lastName.trim(), phone);

    // 2. Generate and store OTP in Redis
    const code = this.authService.generateOtp();
    await this.authService.storeOtp(email, code, 'email');

    // 3. Dispatch OTP via Resend Email API
    const delivery = await this.authService.sendEmailOtp(email, code);

    // 4. Log the OTP request in DB
    await this.authService.logOtpRequest(user.id, 'REGISTRATION', 'EMAIL', email);

    return {
      message: 'Registration details saved. Verification code sent successfully.',
      email,
      accountExists: false,
      deliveryMode: delivery.mode,
      devOtp: delivery.devOtp,
    };
  }

  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend an OTP for registration, password reset, or 2FA' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.key },
          { phone: dto.key }
        ]
      }
    });

    if (!user) {
      throw new BadRequestException('Account not found.');
    }

    const otp = this.authService.generateOtp();
    await this.authService.storeOtp(dto.key, otp, dto.channel);

    const delivery = dto.channel === 'email'
      ? await this.authService.sendEmailOtp(dto.key, otp)
      : await this.authService.sendWhatsAppOtp(dto.key, otp);

    const type = dto.purpose === 'registration'
      ? 'REGISTRATION_RESEND'
      : dto.purpose === '2fa'
        ? '2FA_LOGIN_RESEND'
        : 'PASSWORD_RESET_RESEND';

    await this.authService.logOtpRequest(user.id, type, dto.channel === 'email' ? 'EMAIL' : 'WHATSAPP', dto.key);

    return {
      message: 'A fresh verification code has been sent.',
      recipient: dto.key,
      deliveryMode: delivery.mode,
      devOtp: delivery.devOtp,
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate user credentials' })
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || 'unknown';

    const loginResult = await this.authService.loginUser(dto.email, dto.password, ip, ua);

    if (loginResult.requires2fa) {
      // For 2FA users, send the login code immediately
      const otp = this.authService.generateOtp();
      await this.authService.storeOtp(dto.email, otp, 'email');
      const delivery = await this.authService.sendEmailOtp(dto.email, otp);
      
      const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (user) {
        await this.authService.logOtpRequest(user.id, '2FA_LOGIN', 'EMAIL', dto.email);
      }

      return {
        message: 'Credentials verified. Please complete 2FA verification.',
        requires2fa: true,
        email: dto.email,
        deliveryMode: delivery.mode,
        devOtp: delivery.devOtp,
      };
    }

    return {
      message: 'Authentication successful',
      accessToken: loginResult.accessToken,
      expiresIn: loginResult.expiresIn,
    };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Initiate account recovery flow' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    // Check if user exists
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.inputValue },
          { phone: dto.inputValue }
        ]
      }
    });

    if (!user) {
      throw new BadRequestException('Account not found.');
    }

    const otp = this.authService.generateOtp();
    const channel = dto.method === 'email' ? 'email' : 'phone';
    await this.authService.storeOtp(dto.inputValue, otp, channel);

    if (dto.method === 'email') {
      var delivery = await this.authService.sendEmailOtp(dto.inputValue, otp);
      await this.authService.logOtpRequest(user.id, 'PASSWORD_RESET', 'EMAIL', dto.inputValue);
    } else {
      var delivery = await this.authService.sendWhatsAppOtp(dto.inputValue, otp);
      await this.authService.logOtpRequest(user.id, 'PASSWORD_RESET', 'WHATSAPP', dto.inputValue);
    }

    return {
      message: `Passcode delivered successfully via ${dto.method}.`,
      recipient: dto.inputValue,
      deliveryMode: delivery.mode,
      devOtp: delivery.devOtp,
    };
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP code from SMS or email' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const isEmail = dto.key.includes('@');
    const channel = isEmail ? 'email' : 'phone';

    const isValid = await this.authService.verifyOtp(dto.key, dto.otp, channel);
    if (!isValid) {
      throw new UnauthorizedException('Invalid verification passcode.');
    }

    return { message: 'Identity verified successfully.' };
  }

  @Post('complete-2fa')
  @ApiOperation({ summary: 'Complete 2FA login and issue a session token' })
  async complete2fa(@Req() req: Request, @Body() dto: CompleteTwoFactorDto) {
    const isValid = await this.authService.verifyOtp(dto.email, dto.otp, 'email');
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA verification passcode.');
    }

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || 'unknown';
    const loginResult = await this.authService.completeTwoFactorLogin(dto.email, ip, ua);

    return {
      message: '2FA verification successful',
      accessToken: loginResult.accessToken,
      expiresIn: loginResult.expiresIn,
    };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Create new password and terminate active sessions' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.key },
          { phone: dto.key }
        ]
      }
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    // Terminate other active user sessions
    await this.authService.invalidateUserSessions(user.id);

    return {
      message: 'Password successfully updated. All active sessions invalidated.',
    };
  }
}
