import {
  Module,
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  private async logAudit(req: Request, userId: string, action: string, details: Record<string, any> = {}) {
    try {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1';
      const ua = req.headers['user-agent'] || 'Web Client Native';
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          details,
          ipAddress: ip,
          userAgent: ua,
        },
      });
    } catch (e) {}
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile, KYC, API keys, subscription, risk profile, and DB audit logs' })
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
        isTwoFactorEnabled: true,
        createdAt: true,
        profile: true,
        wallet: true,
        kyc: true,
        amlAlerts: true,
        gamification: true,
        subscription: {
          include: {
            plan: true,
          },
        },
        riskProfile: {
          include: {
            dailyLossRules: true,
          },
        },
        apiKeys: {
          orderBy: { createdAt: 'desc' },
        },
        auditLogs: {
          take: 30,
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }
    return user;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile details, 2FA status, and broker connection in PostgreSQL' })
  async updateMe(@Req() req: Request, @Body() body: any) {
    const userPayload = req.user as any;
    const userId = userPayload.userId;
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
      brokerType,
      brokerKey,
      brokerSecret,
      brokerServer,
      isTwoFactorEnabled,
    } = body;

    if (phone !== undefined || isTwoFactorEnabled !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(phone !== undefined ? { phone: phone || null } : {}),
          ...(isTwoFactorEnabled !== undefined ? { isTwoFactorEnabled: Boolean(isTwoFactorEnabled) } : {}),
        },
      });
    }

    const profileDataPayload = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(middleName !== undefined ? { middleName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(username !== undefined ? { username } : {}),
      ...(dob !== undefined ? { dob } : {}),
      ...(gender !== undefined ? { gender } : {}),
      ...(nationality !== undefined ? { nationality } : {}),
      ...(nationalId !== undefined ? { nationalId } : {}),
      ...(occupation !== undefined ? { occupation } : {}),
      ...(secondaryEmail !== undefined ? { secondaryEmail } : {}),
      ...(communicationPref !== undefined ? { communicationPref } : {}),
      ...(country !== undefined ? { country } : {}),
      ...(state !== undefined ? { state } : {}),
      ...(county !== undefined ? { county } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(postalCode !== undefined ? { postalCode } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(timezone !== undefined ? { timezone } : {}),
      ...(experience !== undefined ? { experience } : {}),
      ...(primaryMarket !== undefined ? { primaryMarket } : {}),
      ...(preferredAssets !== undefined ? { preferredAssets } : {}),
      ...(tradingStyle !== undefined ? { tradingStyle } : {}),
      ...(riskAppetite !== undefined ? { riskAppetite } : {}),
      ...(tradingSession !== undefined ? { tradingSession } : {}),
      ...(baseCurrency !== undefined ? { baseCurrency } : {}),
      ...(leverage !== undefined ? { leverage } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(brokerType !== undefined ? { brokerType } : {}),
      ...(brokerKey !== undefined ? { brokerKey } : {}),
      ...(brokerSecret !== undefined ? { brokerSecret } : {}),
      ...(brokerServer !== undefined ? { brokerServer } : {}),
    };

    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: profileDataPayload,
      create: {
        userId,
        firstName: firstName || 'Trader',
        lastName: lastName || 'Account',
        ...profileDataPayload,
      },
    });

    // Sync BrokerAccount table in PostgreSQL when broker credentials are updated
    if (brokerType !== undefined) {
      if (brokerType === 'None' || !brokerKey) {
        await this.prisma.brokerAccount.updateMany({
          where: { userId },
          data: { connectionStatus: 'DISCONNECTED' },
        });
        await this.logAudit(req, userId, 'Disconnected broker execution terminal');
      } else {
        const existingBroker = await this.prisma.brokerAccount.findFirst({
          where: { userId, accountNumber: brokerKey },
        });
        if (existingBroker) {
          await this.prisma.brokerAccount.update({
            where: { id: existingBroker.id },
            data: {
              broker: brokerType.toUpperCase(),
              platform: brokerType.toUpperCase() === 'MT5' ? 'MT5' : 'API',
              server: brokerServer || 'MetaQuotes-Demo',
              encryptedCredentials: brokerSecret || '',
              connectionStatus: 'CONNECTED',
              lastSyncedAt: new Date(),
            },
          });
        } else {
          await this.prisma.brokerAccount.create({
            data: {
              userId,
              broker: brokerType.toUpperCase(),
              accountType: (brokerServer || '').toLowerCase().includes('demo') ? 'DEMO' : 'LIVE',
              platform: brokerType.toUpperCase() === 'MT5' ? 'MT5' : 'API',
              server: brokerServer || 'MetaQuotes-Demo',
              accountNumber: brokerKey,
              encryptedCredentials: brokerSecret || '',
              connectionStatus: 'CONNECTED',
              balance: 10000,
              equity: 10000,
              freeMargin: 10000,
            },
          });
        }
        await this.logAudit(req, userId, `Connected ${brokerType.toUpperCase()} broker account #${brokerKey}`);
      }
    } else {
      await this.logAudit(req, userId, 'Updated profile & identity settings');
    }

    return { message: 'Profile updated successfully', data: profile };
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Persist Gold Engine v3 SMC, AI Risk & Notification preferences in PostgreSQL' })
  async updatePreferences(@Req() req: Request, @Body() body: any) {
    const userPayload = req.user as any;
    const userId = userPayload.userId;
    const {
      strategy,
      setupMode,
      killzoneWindow,
      automationMode,
      riskLimit,
      maxDrawdown,
      requireStopLoss,
      sessionFilter,
      oteFilter,
      isTwoFactorEnabled,
    } = body;

    if (isTwoFactorEnabled !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isTwoFactorEnabled: Boolean(isTwoFactorEnabled) },
      });
    }

    // Map riskLimit string to AiMode
    const aiMode =
      riskLimit?.includes('1%')
        ? 'CONSERVATIVE'
        : riskLimit?.includes('3%') || riskLimit?.includes('5%')
        ? 'AGGRESSIVE'
        : 'BALANCED';

    await this.prisma.user.update({
      where: { id: userId },
      data: { aiMode: aiMode as any },
    });

    await this.prisma.profile.upsert({
      where: { userId },
      update: {
        tradingStyle: setupMode || undefined,
        tradingSession: killzoneWindow || undefined,
        riskAppetite: riskLimit || undefined,
      },
      create: {
        userId,
        firstName: 'Trader',
        lastName: 'Account',
        tradingStyle: setupMode || 'Dual Engine: SWEEP_REVERSAL + BOS_PULLBACK_CONTINUATION',
        tradingSession: killzoneWindow || 'London Open + NY AM Overlap',
        riskAppetite: riskLimit || 'Max 2% Per Trade',
      },
    });

    const parsedMaxDrawdown = parseFloat(String(maxDrawdown || '10').replace(/[^0-9.]/g, '')) || 10.0;
    const riskProfile = await this.prisma.riskProfile.upsert({
      where: { userId },
      update: {
        riskTolerance: aiMode as any,
      },
      create: {
        userId,
        riskTolerance: aiMode as any,
        maxLeverage: 100.0,
      },
    });

    const existingRule = await this.prisma.dailyLossRule.findFirst({
      where: { riskProfileId: riskProfile.id },
    });
    if (existingRule) {
      await this.prisma.dailyLossRule.update({
        where: { id: existingRule.id },
        data: { maxDailyLossPercent: parsedMaxDrawdown },
      });
    } else {
      await this.prisma.dailyLossRule.create({
        data: {
          riskProfileId: riskProfile.id,
          maxDailyLossPercent: parsedMaxDrawdown,
        },
      });
    }

    await this.logAudit(req, userId, 'Updated Gold Engine v3 SMC & Risk Guard parameters', {
      strategy,
      setupMode,
      killzoneWindow,
      automationMode,
      riskLimit,
      maxDrawdown,
      requireStopLoss,
      sessionFilter,
      oteFilter,
    });

    return { message: 'Engine and risk preferences saved to database.' };
  }

  @Post('me/password')
  @ApiOperation({ summary: 'Verify current password and update passwordHash in PostgreSQL' })
  async updatePassword(@Req() req: Request, @Body() body: { currentPassword?: string; newPassword?: string }) {
    const userPayload = req.user as any;
    const userId = userPayload.userId;

    if (!body?.currentPassword || !body?.newPassword) {
      throw new BadRequestException('Both currentPassword and newPassword are required.');
    }
    if (body.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const isMatch = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const newHash = await bcrypt.hash(body.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await this.logAudit(req, userId, 'Updated account password via Security Center');
    return { message: 'Password updated in database successfully.' };
  }

  @Get('me/api-keys')
  @ApiOperation({ summary: 'List personal API keys from PostgreSQL' })
  async getApiKeys(@Req() req: Request) {
    const userPayload = req.user as any;
    return this.prisma.apiKey.findMany({
      where: { userId: userPayload.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('me/api-keys')
  @ApiOperation({ summary: 'Create and persist a personal API key in PostgreSQL' })
  async createApiKey(@Req() req: Request, @Body() body: { name: string; scopes?: string[] }) {
    const userPayload = req.user as any;
    const userId = userPayload.userId;
    const cleanName = (body?.name || '').trim();
    if (!cleanName) {
      throw new BadRequestException('API key name is required.');
    }

    const rawKey = `tm_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        name: cleanName,
        keyHash: rawKey,
        scopes: body.scopes || ['SIGNALS_READ', 'WEBHOOK_EXECUTION'],
      },
    });

    await this.logAudit(req, userId, `Generated personal API key "${cleanName}"`);
    return created;
  }

  @Delete('me/api-keys/:id')
  @ApiOperation({ summary: 'Revoke and delete a personal API key from PostgreSQL' })
  async deleteApiKey(@Req() req: Request, @Param('id') id: string) {
    const userPayload = req.user as any;
    const userId = userPayload.userId;

    const existing = await this.prisma.apiKey.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new BadRequestException('API key not found.');
    }

    await this.prisma.apiKey.delete({ where: { id } });
    await this.logAudit(req, userId, `Revoked personal API key "${existing.name}"`);
    return { message: 'API key revoked from database.' };
  }

  @Post('me/sessions/revoke')
  @ApiOperation({ summary: 'Revoke active refresh tokens and sessions in PostgreSQL' })
  async revokeSessions(@Req() req: Request) {
    const userPayload = req.user as any;
    const userId = userPayload.userId;

    await Promise.all([
      this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
      this.prisma.session.deleteMany({
        where: { userId },
      }),
    ]);

    await this.logAudit(req, userId, 'Terminated all other active device sessions');
    return { message: 'All other device sessions have been revoked.' };
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
  @ApiOperation({ summary: 'Submit KYC document and record DB audit log' })
  async submitKyc(@Req() req: Request, @Body() body: any) {
    const userPayload = req.user as any;
    const userId = userPayload.userId;
    const { documentType, documentUrl } = body;

    const kyc = await this.prisma.kycRecord.upsert({
      where: { userId },
      update: {
        status: 'PENDING',
        documentType,
        documentUrl,
        faceVerified: documentType === 'SELFIE' ? true : undefined,
      },
      create: {
        userId,
        status: 'PENDING',
        documentType,
        documentUrl,
        faceVerified: documentType === 'SELFIE',
      },
    });

    await this.logAudit(req, userId, `Submitted KYC document: ${documentType}`, { documentUrl });
    return { message: 'KYC documents submitted for review', data: kyc };
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
