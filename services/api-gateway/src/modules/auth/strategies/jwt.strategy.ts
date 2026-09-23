import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    });
  }

  async validate(payload: any) {
    // 1. Check if the session is active in Redis
    const sessionData = await this.redis.getSession(payload.sid);
    if (!sessionData) {
      throw new UnauthorizedException('Session has expired or has been revoked. Please log in again.');
    }

    // 2. Fetch fresh user role and profile state from database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        profile: { select: { riskAppetite: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists.');
    }

    // 3. Immediately enforce suspension block on active tokens
    if (user.profile?.riskAppetite === 'SUSPENDED') {
      throw new ForbiddenException('Your account has been suspended by Administration. Please contact support.');
    }

    // 4. Return fresh role from DB so role changes take effect immediately
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: payload.sid,
    };
  }
}
