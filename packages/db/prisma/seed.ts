const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Pre-hashed password for "Password123" (using bcrypt rounds 10)
const DEFAULT_PASSWORD_HASH = '$2a$10$XSuPKaSAurCHdAWTg.Shw.7FL7Nry3hqEW3cS1FufOpD8whe2aLiC';

async function main() {
  console.log('🌱 Start seeding database...');

  // 1. Clear existing data in reverse order of dependencies
  console.log('Clearing old data...');
  await prisma.quizAttempt.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.course.deleteMany();
  await prisma.tradingStrategy.deleteMany();
  await prisma.marketData.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Users
  console.log('Creating users...');
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@trademind.ai',
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: 'ADMIN',
      profile: {
        create: {
          firstName: 'System',
          lastName: 'Administrator',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
        },
      },
      wallet: {
        create: {
          balance: 1000000.0,
          currency: 'USD',
        },
      },
      riskProfile: {
        create: {
          riskTolerance: 'CONSERVATIVE',
          maxLeverage: 1.0,
          dailyLossRules: {
            create: [
              { maxDailyLossPercent: 2.0, currentDailyLoss: 0.0 }
            ]
          }
        }
      }
    },
  });

  const trader = await prisma.user.create({
    data: {
      email: 'trader@trademind.ai',
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: 'TRADER',
      profile: {
        create: {
          firstName: 'Alex',
          lastName: 'Trader',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=alex',
        },
      },
      wallet: {
        create: {
          balance: 10000.0,
          marginBalance: 0.0,
          currency: 'USD',
        },
      },
      riskProfile: {
        create: {
          riskTolerance: 'BALANCED',
          maxLeverage: 5.0,
          dailyLossRules: {
            create: [
              { maxDailyLossPercent: 5.0, currentDailyLoss: 0.0 }
            ]
          }
        }
      }
    },
  });

  console.log(`Created users: Admin (${admin.email}), Trader (${trader.email})`);

  // 3. Create Trading Strategies
  console.log('Creating trading strategies...');
  const strategy1 = await prisma.tradingStrategy.create({
    data: {
      name: 'Conservative Trend Follower',
      description: 'EMA-200 breakout model focusing on macro trend continuation in high liquidity pairs. Slow trades, high win rates.',
      historicalReturn: 12.5,
      winRate: 58.0,
      riskScore: 2,
      maxDrawdown: 4.5,
      isActive: true,
    },
  });

  const strategy2 = await prisma.tradingStrategy.create({
    data: {
      name: 'Balanced Mean Reversion',
      description: 'RSI divergence model tracking overbought/oversold conditions on 4H timeframes. Mid-frequency trades.',
      historicalReturn: 18.2,
      winRate: 64.0,
      riskScore: 5,
      maxDrawdown: 9.8,
      isActive: true,
    },
  });

  const strategy3 = await prisma.tradingStrategy.create({
    data: {
      name: 'Aggressive Momentum Breakout',
      description: 'Order block bounce model leveraging 15m order flow and volume profile. High frequency, dynamic stops.',
      historicalReturn: 34.8,
      winRate: 71.0,
      riskScore: 8,
      maxDrawdown: 18.5,
      isActive: true,
    },
  });

  console.log('Trading strategies seeded.');

  // 4. Create Market Data
  console.log('Creating market data...');
  await prisma.marketData.createMany({
    data: [
      { symbol: 'BTC', bidPrice: 64200.0, askPrice: 64205.0, volume24h: 31000000000.0 },
      { symbol: 'ETH', bidPrice: 3250.0, askPrice: 3251.0, volume24h: 18000000000.0 },
      { symbol: 'AAPL', bidPrice: 180.50, askPrice: 180.55, volume24h: 98000000.0 },
    ],
  });
  console.log('Market data seeded.');

  // 5. Create Educational Courses
  console.log('Creating courses...');
  const course1 = await prisma.course.create({
    data: {
      title: 'Introduction to Algorithmic Trading',
      description: 'Learn the core concepts of automated market trading, system structures, and indicators.',
      difficulty: 'BEGINNER',
      lessons: {
        create: [
          {
            title: 'Understanding Market Microstructure',
            content: 'Market microstructure deals with how exchange execution happens. We look at bids, asks, spreads, order books, and liquidity pools.',
            orderIndex: 1,
            quizzes: {
              create: [
                {
                  question: 'What is the bid-ask spread?',
                  options: [
                    'The fee charged by an exchange',
                    'The difference between the highest bid price and the lowest ask price',
                    'The total trading volume in 24 hours',
                    'The speed of order execution'
                  ],
                  correctOption: 1,
                },
              ],
            },
          },
          {
            title: 'Moving Averages and Trend Following',
            content: 'Trend following is the concept of going with the market direction. Moving averages smooth out price fluctuations to show the general path.',
            orderIndex: 2,
            quizzes: {
              create: [
                {
                  question: 'What does EMA stand for?',
                  options: [
                    'Exponential Moving Average',
                    'Equal Market Allocation',
                    'Estimated Margin Amount',
                    'Exchange Market Arbitrage'
                  ],
                  correctOption: 0,
                },
              ],
            },
          },
        ],
      },
    },
  });

  const course2 = await prisma.course.create({
    data: {
      title: 'Risk Management in Automated Systems',
      description: 'Master advanced risk control protocols, position sizing, and leverage constraints.',
      difficulty: 'INTERMEDIATE',
      lessons: {
        create: [
          {
            title: 'Position Sizing and Leverage',
            content: 'Position sizing determines how much of your account capital is allocated to a single trade. Leverage amplifies your exposure but increases liquidation risks.',
            orderIndex: 1,
            quizzes: {
              create: [
                {
                  question: 'What happens when your leverage is too high?',
                  options: [
                    'Your trading fees are eliminated',
                    'Your potential profit increases and your risk of liquidation increases',
                    'The exchange guarantees your trade is filled',
                    'Your win rate increases automatically'
                  ],
                  correctOption: 1,
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log('Courses, lessons, and quizzes seeded.');
  console.log('🌿 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
