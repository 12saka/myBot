const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting custom seed for user Timothy...');
  const email = 'sakatimoz7@gmail.com';
  const phone = '0748877746';
  const passwordPlain = 'Timo77';
  const passwordHash = bcrypt.hashSync(passwordPlain, 10);

  // 1. Delete user if exists to avoid duplication
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log(`User ${email} already exists. Deleting to re-create...`);
    // Delete depending tables
    await prisma.profile.deleteMany({ where: { userId: existingUser.id } });
    await prisma.wallet.deleteMany({ where: { userId: existingUser.id } });
    await prisma.riskProfile.deleteMany({ where: { userId: existingUser.id } });
    await prisma.subscription.deleteMany({ where: { userId: existingUser.id } });
    await prisma.portfolio.deleteMany({ where: { userId: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  // 2. Create user with transaction
  const user = await prisma.user.create({
    data: {
      email,
      phone,
      passwordHash,
      role: 'TRADER',
      profile: {
        create: {
          firstName: 'Timothy',
          lastName: 'Kipchirchir',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=timothy',
          address: 'Nairobi, Kenya',
        },
      },
      wallet: {
        create: {
          balance: 25000.0, // 25,000 USD
          currency: 'USD',
        },
      },
      riskProfile: {
        create: {
          riskTolerance: 'BALANCED',
          maxLeverage: 10.0,
          dailyLossRules: {
            create: [
              { maxDailyLossPercent: 5.0, currentDailyLoss: 0.0 }
            ]
          }
        }
      },
      // Premium Subscription Active
      subscription: {
        create: {
          plan: 'PREMIUM',
          status: 'ACTIVE',
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Active 1 year
        }
      },
      // Add default portfolio
      portfolios: {
        create: {
          name: 'Timothy Premium Portfolio',
          diversificationScore: 85.0,
          riskScore: 3.5,
          sharpeRatio: 1.82,
          maxDrawdown: 6.4,
          assets: {
            create: [
              { symbol: 'BTC', quantity: 0.25, averagePrice: 62000.0, currentPrice: 64200.0 },
              { symbol: 'ETH', quantity: 1.5, averagePrice: 3100.0, currentPrice: 3250.0 }
            ]
          }
        }
      }
    }
  });

  console.log(` Timothy Kipchirchir seeded successfully!`);
  console.log(`Email: ${email}`);
  console.log(`Phone: ${phone}`);
  console.log(`Password: ${passwordPlain}`);
  console.log(`Subscription: PREMIUM (Active)`);
}

main()
  .catch((e) => {
    console.error('Error seeding Timothy:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
