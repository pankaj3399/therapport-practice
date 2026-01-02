// User types
export type UserRole = 'practitioner' | 'admin';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  photoUrl?: string;
  role: UserRole;
  nextOfKin?: NextOfKin;
  emailVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NextOfKin {
  name: string;
  email: string;
  phone: string;
}

// Auth types
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangeEmailRequest {
  newEmail: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

