import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

const authService = new AuthService();

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required')
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required')
});

export async function handleRegister(req: Request, res: Response) {
  try {
    const parsedData = registerSchema.parse(req.body);
    const user = await authService.register({
      email: parsedData.email,
      phone: parsedData.phone,
      passwordHash: parsedData.password,
      firstName: parsedData.firstName,
      lastName: parsedData.lastName
    });
    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: error.errors });
    }
    const err = error as Error;
    if (err.message === 'USER_ALREADY_EXISTS') {
      return res.status(409).json({ error: 'USER_ALREADY_EXISTS', message: 'Email or phone number is already registered' });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
}

export async function handleLogin(req: Request, res: Response) {
  try {
    const parsedData = loginSchema.parse(req.body);
    const result = await authService.login(parsedData.email, parsedData.password);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: error.errors });
    }
    const err = error as Error;
    if (err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
}

export async function handleGetMe(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Session data not found' });
    }
    const user = await authService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
}
