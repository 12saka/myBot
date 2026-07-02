import { Controller, Post, Body, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { AuthService } from './auth.service';

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
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  async register(@Body() dto: RegisterDto) {
    // Generate code and send email verification
    const code = this.authService.generateOtp();
    await this.authService.storeOtp(dto.email, code);
    await this.authService.sendEmailOtp(dto.email, code);

    return {
      message: 'Registration details saved. Verification code sent successfully.',
      email: dto.email,
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate user credentials' })
  async login(@Body() dto: LoginDto) {
    // Mock login verification
    return {
      message: 'Credentials verified. Please complete 2FA verification.',
      accessToken: 'jwt-auth-session-key',
      expiresIn: 3600,
    };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Initiate account recovery flow' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const otp = this.authService.generateOtp();
    await this.authService.storeOtp(dto.inputValue, otp);

    if (dto.method === 'email') {
      await this.authService.sendEmailOtp(dto.inputValue, otp);
    } else {
      await this.authService.sendWhatsAppOtp(dto.inputValue, otp);
    }

    return {
      message: `Passcode delivered successfully via ${dto.method}.`,
      recipient: dto.inputValue,
    };
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP code from SMS or email' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const isValid = await this.authService.verifyOtp(dto.key, dto.otp);
    if (!isValid) {
      throw new UnauthorizedException('Invalid verification passcode.');
    }
    return { message: 'Identity verified successfully.' };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Create new password and terminate active sessions' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    // Simulate updating user password in DB...
    const userId = 'user-uuid-12345'; // mock user ID resolved from email/phone

    // Terminate other active user sessions
    await this.authService.invalidateUserSessions(userId);

    return {
      message: 'Password successfully updated. All active sessions invalidated.',
    };
  }
}
