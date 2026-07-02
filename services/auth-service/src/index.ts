import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleRegister, handleLogin, handleGetMe } from './modules/auth/auth.controller.js';
import { authMiddleware } from './middleware/auth.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

// Auth Endpoints
app.post('/api/auth/register', handleRegister);
app.post('/api/auth/login', handleLogin);
app.get('/api/auth/me', authMiddleware as any, handleGetMe as any);

// Base Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'auth-service' });
});

app.listen(PORT, () => {
  console.log(`[AuthService] Listening on http://localhost:${PORT}`);
});
