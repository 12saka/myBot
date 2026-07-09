import { prisma } from '@trademind/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'trademind_super_secret_jwt_key';

export class AuthService {
  async register(data: {
    email: string;
    phone?: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          ...(data.phone ? [{ phone: data.phone }] : [])
        ]
      }
    });

    if (existingUser) {
      throw new Error('USER_ALREADY_EXISTS');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.passwordHash, salt);

    // Create User, Profile, Wallet, and Default Portfolio in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          phone: data.phone,
          passwordHash: hashedPassword,
          role: 'TRADER'
        }
      });

      await tx.profile.create({
        data: {
          userId: newUser.id,
          firstName: data.firstName,
          lastName: data.lastName
        }
      });

      const newWallet = await tx.wallet.create({
        data: {
          userId: newUser.id,
          balance: 100000.0, // Starting simulated capital
          currency: 'USD'
        }
      });

      const defaultPortfolio = await tx.portfolio.create({
        data: {
          userId: newUser.id,
          name: 'Default Paper Portfolio',
        }
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          userId: newUser.id,
          action: 'USER_REGISTER',
          details: {
            email: newUser.email,
            walletId: newWallet.id,
            portfolioId: defaultPortfolio.id
          }
        }
      });

      return newUser;
    });

    const { passwordHash, ...safeUser } = result;
    return safeUser;
  }

  async login(email: string, passwordHash: string) {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(passwordHash, user.passwordHash);
    if (!isMatch) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log login audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        details: { ip: 'system' }
      }
    });

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        wallet: true,
        portfolios: {
          select: { id: true, name: true }
        }
      }
    });

    if (!user) return null;

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }
}
