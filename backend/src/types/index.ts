// User types
export type UserRole = 'practitioner' | 'admin';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
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

// Membership types
export type MembershipType = 'permanent' | 'ad_hoc';

export interface Membership {
  id: string;
  userId: string;
  type: MembershipType;
  marketingAddon: boolean;
  permanentSchedule?: PermanentSchedule;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermanentSchedule {
  weekday: number; // 0-6 (Sunday-Saturday)
  slot: 'morning' | 'afternoon'; // 08:00-15:00 or 15:00-22:00
}

// Location types
export type LocationName = 'Pimlico' | 'Kensington';

export interface Location {
  id: string;
  name: LocationName;
  roomCount: number;
  createdAt: Date;
}

// Room types
export interface Room {
  id: string;
  locationId: string;
  name: string;
  roomNumber: number;
  active: boolean;
  createdAt: Date;
}

// Booking types
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';
export type BookingType = 'permanent_recurring' | 'ad_hoc' | 'free' | 'internal';

export interface Booking {
  id: string;
  userId: string;
  roomId: string;
  membershipId: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  pricePerHour: number;
  totalPrice: number;
  status: BookingStatus;
  bookingType: BookingType;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
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
  user: Omit<User, 'passwordHash'>;
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

export interface VerifyEmailRequest {
  token: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

