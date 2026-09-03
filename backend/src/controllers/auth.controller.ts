import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ENV } from '../config/env.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = LoginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email },
        include: { assignedLocation: true }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      const tokenPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        assignedLocationId: user.assignedLocationId
      };

      const token = jwt.sign(tokenPayload, ENV.JWT_SECRET, { expiresIn: '24h' });

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            assignedLocation: user.assignedLocation
          }
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { assignedLocation: true }
      });

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      return res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          assignedLocation: user.assignedLocation
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          assignedLocationId: true
        }
      });

      return res.json({ success: true, data: users });
    } catch (err) {
      return next(err);
    }
  }
}
