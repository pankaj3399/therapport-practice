import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { users, passwordResets, emailChangeRequests } from '../db/schema';
import { hashPassword, comparePassword } from '../utils/password.util';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.util';
import { emailService } from './email.service';
import { randomBytes } from 'crypto';
import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangeEmailRequest,
} from '../types';

export class AuthService {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, data.email.toLowerCase()),
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Generate temporary password for email
    const tempPassword = data.password;

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'practitioner',
      })
      .returning();

    // Send welcome email
    await emailService.sendWelcomeEmail({
      firstName: data.firstName,
      email: data.email,
      password: tempPassword,
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });
    const refreshToken = generateRefreshToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        photoUrl: newUser.photoUrl || undefined,
        role: newUser.role,
        nextOfKin: newUser.nextOfKin as any,
        emailVerifiedAt: newUser.emailVerifiedAt || undefined,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, data.email.toLowerCase()),
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl || undefined,
        role: user.role,
        nextOfKin: user.nextOfKin as any,
        emailVerifiedAt: user.emailVerifiedAt || undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, data.email.toLowerCase()),
    });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // Generate reset token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Delete any existing reset tokens for this user
    await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));

    // Create new reset token
    await db.insert(passwordResets).values({
      userId: user.id,
      token,
      expiresAt,
      used: false,
    });

    // Send reset email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await emailService.sendPasswordResetEmail({
      firstName: user.firstName,
      email: user.email,
      resetLink,
    });
  }

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    const resetRecord = await db.query.passwordResets.findFirst({
      where: eq(passwordResets.token, data.token),
    });

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await hashPassword(data.password);

    // Update user password
    await db.update(users).set({ passwordHash }).where(eq(users.id, resetRecord.userId));

    // Mark token as used
    await db.update(passwordResets).set({ used: true }).where(eq(passwordResets.id, resetRecord.id));
  }

  async changeEmail(userId: string, data: ChangeEmailRequest): Promise<void> {
    // Check if new email is already in use
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, data.newEmail.toLowerCase()),
    });

    if (existingUser) {
      throw new Error('Email already in use');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate verification token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    // Delete any existing change requests for this user
    await db.delete(emailChangeRequests).where(eq(emailChangeRequests.userId, userId));

    // Create new change request
    await db.insert(emailChangeRequests).values({
      userId,
      newEmail: data.newEmail.toLowerCase(),
      token,
      expiresAt,
      verified: false,
    });

    // Send verification email to new address
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email-change?token=${token}`;
    await emailService.sendEmailChangeVerification({
      firstName: user.firstName,
      verificationLink,
      newEmail: data.newEmail,
    });
  }

  async verifyEmailChange(token: string): Promise<void> {
    const changeRequest = await db.query.emailChangeRequests.findFirst({
      where: eq(emailChangeRequests.token, token),
    });

    if (!changeRequest || changeRequest.verified || changeRequest.expiresAt < new Date()) {
      throw new Error('Invalid or expired verification token');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, changeRequest.userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    const oldEmail = user.email;

    // Update user email
    await db
      .update(users)
      .set({ email: changeRequest.newEmail, emailVerifiedAt: new Date() })
      .where(eq(users.id, changeRequest.userId));

    // Mark change request as verified
    await db
      .update(emailChangeRequests)
      .set({ verified: true })
      .where(eq(emailChangeRequests.id, changeRequest.id));

    // Send confirmation to old email
    await emailService.sendEmailChangeConfirmation({
      firstName: user.firstName,
      oldEmail,
    });
  }
}

export const authService = new AuthService();

