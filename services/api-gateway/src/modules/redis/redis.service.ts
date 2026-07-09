import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client?: Redis;
  private isFallbackMode = false;
  
  // In-memory fallback stores
  private sessionStore = new Map<string, { data: Record<string, string>; expiresAt: number }>();
  private userSessionsStore = new Map<string, Set<string>>(); // userId -> Set of sessionIds
  private otpStore = new Map<string, { value: string; expiresAt: number }>(); // key -> hash

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 1500, // Fail fast if Redis is down
        lazyConnect: true,
      });

      this.client.on('error', (err) => {
        if (!this.isFallbackMode) {
          console.warn('⚠️ [REDIS CACHE] Redis server offline. Falling back to In-Memory Session & OTP Registry.');
          this.isFallbackMode = true;
        }
      });

      // Attempt background connection
      this.client.connect().catch(() => {
        this.isFallbackMode = true;
      });
    } catch (e) {
      this.isFallbackMode = true;
      console.warn('⚠️ [REDIS CACHE] Redis initialization failed. Falling back to In-Memory Session & OTP Registry.');
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  /**
   * Create a new session in Redis or In-Memory.
   */
  async createSession(
    userId: string,
    sessionId: string,
    metadata: { ipAddress: string; userAgent: string },
    ttlSeconds: number = 3600
  ): Promise<void> {
    const expiresAtMs = Date.now() + ttlSeconds * 1000;

    if (!this.isFallbackMode && this.client) {
      try {
        const sessionKey = `session:${sessionId}`;
        const userSessionsKey = `user:sessions:${userId}`;

        await this.client.hset(sessionKey, {
          userId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(expiresAtMs).toISOString(),
        });
        await this.client.expire(sessionKey, ttlSeconds);
        await this.client.sadd(userSessionsKey, sessionId);
        await this.client.expire(userSessionsKey, ttlSeconds + 300);
        return;
      } catch (err) {
        console.warn('⚠️ [REDIS CACHE] Failed to write session to Redis. Falling back to In-Memory store.');
        this.isFallbackMode = true;
      }
    }

    // In-memory fallback
    const sessionData = {
      userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
    this.sessionStore.set(sessionId, { data: sessionData, expiresAt: expiresAtMs });

    if (!this.userSessionsStore.has(userId)) {
      this.userSessionsStore.set(userId, new Set());
    }
    this.userSessionsStore.get(userId)!.add(sessionId);
  }

  /**
   * Fetch active session metadata.
   */
  async getSession(sessionId: string): Promise<Record<string, string> | null> {
    if (!this.isFallbackMode && this.client) {
      try {
        const sessionKey = `session:${sessionId}`;
        const data = await this.client.hgetall(sessionKey);
        if (data && Object.keys(data).length > 0) {
          return data;
        }
        return null;
      } catch (err) {
        this.isFallbackMode = true;
      }
    }

    // In-memory fallback
    const session = this.sessionStore.get(sessionId);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.sessionStore.delete(sessionId);
      return null;
    }
    return session.data;
  }

  /**
   * Revoke a single session.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    if (!this.isFallbackMode && this.client) {
      try {
        const sessionKey = `session:${sessionId}`;
        const userSessionsKey = `user:sessions:${userId}`;
        await this.client.del(sessionKey);
        await this.client.srem(userSessionsKey, sessionId);
        return;
      } catch (err) {
        this.isFallbackMode = true;
      }
    }

    // In-memory fallback
    this.sessionStore.delete(sessionId);
    const userSet = this.userSessionsStore.get(userId);
    if (userSet) {
      userSet.delete(sessionId);
    }
  }

  /**
   * Revoke all active sessions for a user.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    if (!this.isFallbackMode && this.client) {
      try {
        const userSessionsKey = `user:sessions:${userId}`;
        const sessionIds = await this.client.smembers(userSessionsKey);

        if (sessionIds.length > 0) {
          const pipeline = this.client.pipeline();
          for (const sessionId of sessionIds) {
            pipeline.del(`session:${sessionId}`);
          }
          pipeline.del(userSessionsKey);
          await pipeline.exec();
        }
        return;
      } catch (err) {
        this.isFallbackMode = true;
      }
    }

    // In-memory fallback
    const userSet = this.userSessionsStore.get(userId);
    if (userSet) {
      for (const sessionId of userSet) {
        this.sessionStore.delete(sessionId);
      }
      this.userSessionsStore.delete(userId);
    }
  }

  /**
   * Cache a hashed OTP key.
   */
  async storeOtp(channel: string, identifier: string, codeHash: string, ttlSeconds: number = 300): Promise<void> {
    const key = `${channel}:${identifier}`;
    const expiresAtMs = Date.now() + ttlSeconds * 1000;

    if (!this.isFallbackMode && this.client) {
      try {
        const otpKey = `otp:${key}`;
        await this.client.setex(otpKey, ttlSeconds, codeHash);
        return;
      } catch (err) {
        this.isFallbackMode = true;
      }
    }

    // In-memory fallback
    this.otpStore.set(key, { value: codeHash, expiresAt: expiresAtMs });
  }

  /**
   * Fetch a cached OTP key.
   */
  async getOtp(channel: string, identifier: string): Promise<string | null> {
    const key = `${channel}:${identifier}`;

    if (!this.isFallbackMode && this.client) {
      try {
        const otpKey = `otp:${key}`;
        return await this.client.get(otpKey);
      } catch (err) {
        this.isFallbackMode = true;
      }
    }

    // In-memory fallback
    const otp = this.otpStore.get(key);
    if (!otp) return null;

    if (Date.now() > otp.expiresAt) {
      this.otpStore.delete(key);
      return null;
    }
    return otp.value;
  }

  /**
   * Delete a cached OTP key.
   */
  async deleteOtp(channel: string, identifier: string): Promise<void> {
    const key = `${channel}:${identifier}`;

    if (!this.isFallbackMode && this.client) {
      try {
        const otpKey = `otp:${key}`;
        await this.client.del(otpKey);
        return;
      } catch (err) {
        this.isFallbackMode = true;
      }
    }

    // In-memory fallback
    this.otpStore.delete(key);
  }
}
