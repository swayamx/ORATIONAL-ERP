import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/login', AuthController.login);
authRouter.get('/me', authenticate, AuthController.me);
authRouter.get('/users', authenticate, AuthController.listUsers);
