import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

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

router.post('/register', validate(registerSchema), authController.register.bind(authController));
router.post('/login', validate(loginSchema), authController.login.bind(authController));
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword.bind(authController));
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword.bind(authController));
router.post('/change-email', authenticate, validate(changeEmailSchema), authController.changeEmail.bind(authController));
router.get('/verify-email-change', authController.verifyEmailChange.bind(authController));
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword.bind(authController));
router.put('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile.bind(authController));
router.post('/refresh', authController.refreshToken.bind(authController));
router.get('/me', authenticate, authController.getCurrentUser.bind(authController));

export default router;

