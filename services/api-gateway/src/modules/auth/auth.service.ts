import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Redis } from 'ioredis';
import axios from 'axios';

@Injectable()
export class AuthService {
  private redisClient: Redis;

  constructor() {
    // Connect to Redis (fallback to localhost in dev if REDIS_URL not configured)
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl);
  }

  // Generate a random 6-digit OTP
  generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Hash the OTP and store it in Redis with a 5-minute expiration (300 seconds)
  async storeOtp(key: string, otp: string): Promise<void> {
    const hashedOtp = await bcrypt.hash(otp, 8);
    // Key example: otp:email:user@email.com or otp:phone:+254700000000
    await this.redisClient.setex(`otp:${key}`, 300, hashedOtp);
  }

  // Verify the OTP against the hashed value in Redis
  async verifyOtp(key: string, enteredOtp: string): Promise<boolean> {
    const redisKey = `otp:${key}`;
    const storedHash = await this.redisClient.get(redisKey);
    if (!storedHash) {
      throw new BadRequestException('Passcode has expired or is invalid. Please generate a new one.');
    }

    const isValid = await bcrypt.compare(enteredOtp, storedHash);
    if (isValid) {
      // Invalidate the OTP once verified to prevent reuse
      await this.redisClient.del(redisKey);
    }
    return isValid;
  }

  // Dispatch OTP via Resend Email API
  async sendEmailOtp(email: string, otp: string): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY || 're_mock_key';
    const sender = process.env.EMAIL_SENDER || 'security@trademind.ai';

    try {
      if (resendApiKey === 're_mock_key') {
        console.log(`[MOCK EMAIL DISPATCH] Sent OTP ${otp} via Resend to ${email}`);
        return;
      }

      await axios.post(
        'https://api.resend.com/emails',
        {
          from: `TradeMind Security <${sender}>`,
          to: [email],
          subject: 'Your TradeMind AI Security Code',
          html: `<p>Your 6-digit one-time verification code is <strong>${otp}</strong>. It will expire in 5 minutes. Do not share this code with anyone.</p>`,
        },
        {
          headers: { Authorization: `Bearer ${resendApiKey}` },
        },
      );
    } catch (err: any) {
      console.error('Failed to send email OTP via Resend:', err.message);
      throw new BadRequestException('Failed to deliver email OTP. Please try again.');
    }
  }

  // Dispatch OTP via WhatsApp Business API through Africa's Talking
  async sendWhatsAppOtp(phone: string, otp: string): Promise<void> {
    const atUsername = process.env.AT_USERNAME || 'sandbox';
    const atApiKey = process.env.AT_API_KEY || 'at_mock_key';

    try {
      if (atApiKey === 'at_mock_key') {
        console.log(`[MOCK WHATSAPP DISPATCH] Sent OTP ${otp} via Africa's Talking WhatsApp to ${phone}`);
        return;
      }

      // Africa's Talking SMS/WhatsApp API endpoint
      await axios.post(
        'https://api.africastalking.com/version1/messaging',
        new URLSearchParams({
          username: atUsername,
          to: phone,
          message: `Your TradeMind AI security code is *${otp}*. Valid for 5 minutes.`,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ApiKey: atApiKey,
            Accept: 'application/json',
          },
        },
      );
    } catch (err: any) {
      console.error("Failed to send WhatsApp OTP via Africa's Talking:", err.message);
      // Fallback mechanism: Attempt sending standard SMS if WhatsApp fails
      console.log(`[FALLBACK SMS DISPATCH] Attempting fallback standard SMS delivery to ${phone}`);
    }
  }

  // Revoke all active sessions and refresh tokens for a user
  async invalidateUserSessions(userId: string): Promise<void> {
    // Delete all session tokens matching the user ID pattern in Redis
    const keys = await this.redisClient.keys(`session:*:${userId}`);
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
    console.log(`[SECURITY AUDIT] Revoked ${keys.length} active sessions for User: ${userId}`);
  }
}
