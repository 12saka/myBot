import { Response } from 'express';
import { z } from 'zod';
import { WalletService } from './wallet.service.js';
import { AuthenticatedRequest } from '@trademind/shared';

const walletService = new WalletService();

const amountSchema = z.object({
  amount: z.number().positive('Amount must be positive')
});

export async function handleGetWallet(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session not found' });
    }
    const wallet = await walletService.getWallet(req.user.id);
    if (!wallet) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Wallet not found' });
    }
    return res.status(200).json({ success: true, data: wallet });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
}

export async function handleDeposit(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session not found' });
    }
    const parsedData = amountSchema.parse(req.body);
    const wallet = await walletService.deposit(req.user.id, parsedData.amount);
    return res.status(200).json({ success: true, data: wallet });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: error.errors });
    }
    const err = error as Error;
    if (err.message === 'WALLET_NOT_FOUND') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User wallet not found' });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
}

export async function handleWithdraw(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session not found' });
    }
    const parsedData = amountSchema.parse(req.body);
    const wallet = await walletService.withdraw(req.user.id, parsedData.amount);
    return res.status(200).json({ success: true, data: wallet });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: error.errors });
    }
    const err = error as Error;
    if (err.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'INSUFFICIENT_FUNDS', message: 'Account balance is insufficient' });
    }
    if (err.message === 'WALLET_NOT_FOUND') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User wallet not found' });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
}
