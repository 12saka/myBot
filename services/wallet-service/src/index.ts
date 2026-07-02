import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleGetWallet, handleDeposit, handleWithdraw } from './modules/wallet/wallet.controller.js';
import { authMiddleware } from '@trademind/shared';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

// Wallet Endpoints (all authenticated)
app.get('/api/wallet', authMiddleware as any, handleGetWallet as any);
app.post('/api/wallet/deposit', authMiddleware as any, handleDeposit as any);
app.post('/api/wallet/withdraw', authMiddleware as any, handleWithdraw as any);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'wallet-service' });
});

app.listen(PORT, () => {
  console.log(`[WalletService] Listening on http://localhost:${PORT}`);
});
