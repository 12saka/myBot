import { prisma } from '@trademind/db';

export class WalletService {
  async getWallet(userId: string) {
    return prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });
  }

  async deposit(userId: string, amount: number, currency: string = 'USD') {
    if (amount <= 0) {
      throw new Error('INVALID_AMOUNT');
    }

    return prisma.$transaction(async (tx) => {
      // Pessimistic lock on the user's wallet
      const wallets = await tx.$queryRaw<any[]>`
        SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
      `;

      if (!wallets || wallets.length === 0) {
        throw new Error('WALLET_NOT_FOUND');
      }

      const wallet = wallets[0];
      const newBalance = wallet.balance + amount;

      // Update the wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance }
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount: amount,
          status: 'COMPLETED'
        }
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'WALLET_DEPOSIT',
          details: {
            walletId: wallet.id,
            amount,
            newBalance,
            transactionId: transaction.id
          }
        }
      });

      return updatedWallet;
    });
  }

  async withdraw(userId: string, amount: number) {
    if (amount <= 0) {
      throw new Error('INVALID_AMOUNT');
    }

    return prisma.$transaction(async (tx) => {
      // Pessimistic lock on the user's wallet
      const wallets = await tx.$queryRaw<any[]>`
        SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
      `;

      if (!wallets || wallets.length === 0) {
        throw new Error('WALLET_NOT_FOUND');
      }

      const wallet = wallets[0];

      // Check balance limit
      if (wallet.balance < amount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      let newBalance = wallet.balance;
      let newFrozenBalance = wallet.frozenBalance;
      let status: 'COMPLETED' | 'UNDER_REVIEW' = 'COMPLETED';

      // Rule: Withdrawals > $5,000 require manual review and are frozen first
      if (amount >= 5000) {
        newBalance -= amount;
        newFrozenBalance += amount;
        status = 'UNDER_REVIEW';
      } else {
        newBalance -= amount;
      }

      // Update the wallet
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          frozenBalance: newFrozenBalance
        }
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount: amount,
          status: status
        }
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'WALLET_WITHDRAWAL',
          details: {
            walletId: wallet.id,
            amount,
            status,
            newBalance,
            newFrozenBalance,
            transactionId: transaction.id
          }
        }
      });

      return updatedWallet;
    });
  }
}
