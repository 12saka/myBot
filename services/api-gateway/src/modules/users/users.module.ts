import { Module, Controller, Get, Patch, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile and verification statuses' })
  async getMe(@Req() req: Request) {
    const userPayload = req.user as any;
    const user = await this.prisma.user.findUnique({
      where: { id: userPayload.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        aiMode: true,
        createdAt: true,
        profile: true,
        wallet: true,
        kyc: true,
        amlAlerts: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }
    return user;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile details' })
  async updateMe(@Req() req: Request, @Body() body: any) {
    const userPayload = req.user as any;
    const {
      firstName,
      middleName,
      lastName,
      username,
      dob,
      gender,
      nationality,
      nationalId,
      occupation,
      secondaryEmail,
      communicationPref,
      country,
      state,
      county,
      city,
      postalCode,
      address,
      timezone,
      experience,
      primaryMarket,
      preferredAssets,
      tradingStyle,
      riskAppetite,
      tradingSession,
      baseCurrency,
      leverage,
      avatarUrl,
      phone,
    } = body;

    if (phone !== undefined) {
      await this.prisma.user.update({
        where: { id: userPayload.userId },
        data: { phone: phone || null },
      });
    }

    const profile = await this.prisma.profile.update({
      where: { userId: userPayload.userId },
      data: {
        firstName,
        middleName,
        lastName,
        username,
        dob,
        gender,
        nationality,
        nationalId,
        occupation,
        secondaryEmail,
        communicationPref,
        country,
        state,
        county,
        city,
        postalCode,
        address,
        timezone,
        experience,
        primaryMarket,
        preferredAssets,
        tradingStyle,
        riskAppetite,
        tradingSession,
        baseCurrency,
        leverage,
        avatarUrl,
      },
    });

    return { message: 'Profile updated successfully', data: profile };
  }

  @Get('me/kyc')
  @ApiOperation({ summary: 'Get KYC verification details' })
  async getKyc(@Req() req: Request) {
    const userPayload = req.user as any;
    let kyc = await this.prisma.kycRecord.findUnique({
      where: { userId: userPayload.userId },
    });

    if (!kyc) {
      kyc = await this.prisma.kycRecord.create({
        data: {
          userId: userPayload.userId,
          status: 'UNVERIFIED',
        },
      });
    }

    return kyc;
  }

  @Post('me/kyc')
  @ApiOperation({ summary: 'Submit KYC document' })
  async submitKyc(@Req() req: Request, @Body() body: any) {
    const userPayload = req.user as any;
    const { documentType, documentUrl } = body;

    const kyc = await this.prisma.kycRecord.upsert({
      where: { userId: userPayload.userId },
      update: {
        status: 'PENDING',
        documentType,
        documentUrl,
        faceVerified: false,
      },
      create: {
        userId: userPayload.userId,
        status: 'PENDING',
        documentType,
        documentUrl,
        faceVerified: false,
      },
    });

    return { message: 'KYC documents submitted for review', data: kyc };
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
