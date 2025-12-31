import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.middleware';

const registerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const changeEmailSchema = z.object({
  newEmail: z.string().email(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  nextOfKin: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(401).json({ success: false, error: error.message });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      await authService.forgotPassword(data);
      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const data = resetPasswordSchema.parse(req.body);
      await authService.resetPassword(data);
      res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async changeEmail(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const data = changeEmailSchema.parse(req.body);
      await authService.changeEmail(req.user.id, data);
      res.status(200).json({
        success: true,
        message: 'Verification email sent to new address',
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async verifyEmailChange(req: Request, res: Response) {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ success: false, error: 'Token is required' });
      }

      await authService.verifyEmailChange(token);
      res.status(200).json({ success: true, message: 'Email changed successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getCurrentUser(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Fetch full user data
      const { db } = await import('../config/database');
      const { users } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user.id),
      });

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl || undefined,
          role: user.role,
          nextOfKin: user.nextOfKin,
          emailVerifiedAt: user.emailVerifiedAt || undefined,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async changePassword(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const data = changePasswordSchema.parse(req.body);
      await authService.changePassword(req.user.id, data);
      res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const data = updateProfileSchema.parse(req.body);
      const updatedUser = await authService.updateProfile(req.user.id, data);
      res.status(200).json({ success: true, data: updatedUser });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ success: false, error: 'Refresh token is required' });
      }

      const tokens = await authService.refreshToken(refreshToken);
      res.status(200).json({ success: true, data: tokens });
    } catch (error: any) {
      res.status(401).json({ success: false, error: error.message });
    }
  }
}

export const authController = new AuthController();
