import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '../types';
import type { DocumentData } from '../types/documents';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        // No refresh token, clear everything and let ProtectedRoute handle redirect
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        processQueue(new Error('No refresh token'), null);
        isRefreshing = false;
        // Dispatch custom event to trigger auth check
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }

      try {
        // Try to refresh the token
        const response = await axios.post<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
          `${API_URL}/auth/refresh`,
          { refreshToken }
        );

        if (response.data.success && response.data.data) {
          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          // Update the original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }

          processQueue(null, accessToken);
          isRefreshing = false;

          // Retry the original request
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        processQueue(refreshError, null);
        isRefreshing = false;
        // Dispatch custom event to trigger auth check
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Helper function to validate userId
const validateUserId = (userId: string): void => {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error(`Invalid userId parameter: "${userId}". userId must be a non-empty string.`);
  }
};

// Practitioner API methods
export const practitionerApi = {
  getInsuranceDocument: (signal?: AbortSignal) => {
    return api.get<ApiResponse<DocumentData>>('/practitioner/documents/insurance', {
      signal,
    });
  },

  getClinicalDocument: (signal?: AbortSignal) => {
    return api.get<ApiResponse<DocumentData>>('/practitioner/documents/clinical', {
      signal,
    });
  },
};

// Admin API methods
export const adminApi = {
  getAdminStats: () => {
    return api.get<ApiResponse<{
      practitionerCount: number;
    }>>('/admin/stats');
  },

  getPractitioners: (search?: string) => {
    const params = search ? { search } : {};
    return api.get<ApiResponse<Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      membership: {
        id?: string;
        type: 'permanent' | 'ad_hoc';
        marketingAddon: boolean;
      } | null;
    }>>>('/admin/practitioners', { params });
  },

  getPractitioner: (userId: string) => {
    try {
      validateUserId(userId);
    } catch (error) {
      return Promise.reject(error);
    }

    return api.get<ApiResponse<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      role: string;
      membership: {
        id?: string;
        type: 'permanent' | 'ad_hoc';
        marketingAddon: boolean;
      } | null;
    }>>(`/admin/practitioners/${userId}`);
  },

  getPractitionersWithMissingInfo: (page = 1, limit = 10, signal?: AbortSignal) => {
    return api.get<ApiResponse<{
      data: Array<{
        id: string;
        name: string;
        missing: string[];
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>>('/admin/practitioners/missing-info', { params: { page, limit }, signal });
  },

  updateMembership: (userId: string, data: {
    type?: 'permanent' | 'ad_hoc' | null;
    marketingAddon?: boolean;
  }) => {
    try {
      validateUserId(userId);
    } catch (error) {
      return Promise.reject(error);
    }

    // Validate business rule: marketingAddon can only be true when type === 'permanent'
    // Only validate when type is explicitly provided to allow partial updates
    if (data.marketingAddon === true && data.type !== undefined && data.type !== 'permanent') {
      return Promise.reject(
        new Error('Marketing add-on can only be enabled for permanent memberships. Type must be "permanent" when marketingAddon is true.')
      );
    }

    return api.put<ApiResponse<{
      id: string;
      type: 'permanent' | 'ad_hoc';
      marketingAddon: boolean;
    }>>(`/admin/practitioners/${userId}/membership`, data);
  },
};

export default api;

