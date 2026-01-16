import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, UserStatus, PractitionerMembership, NextOfKin, ClinicalExecutor } from '../types';
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
      adHocCount: number;
      permanentCount: number;
    }>>('/admin/stats');
  },

  getPractitioners: (search?: string, page = 1, limit = 10) => {
    const params = { ...(search ? { search } : {}), page, limit };
    // Refine the type to include mandatory pagination at the top level
    return api.get<ApiResponse<Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      status: UserStatus;
      membership: PractitionerMembership | null;
    }>> & {
      pagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
      }
    }>('/admin/practitioners', { params });
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
      status: UserStatus;
      membership: PractitionerMembership | null;
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

    return api.put<ApiResponse<{
      id: string;
      type: 'permanent' | 'ad_hoc';
      marketingAddon: boolean;
    }>>(`/admin/practitioners/${userId}/membership`, data);
  },

  // Get full practitioner details (documents, next of kin, clinical executor)
  getFullPractitioner: (userId: string) => {
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
      photoUrl?: string;

      role: string;
      status: UserStatus;
      nextOfKin: NextOfKin | null;
      createdAt: string;
      membership: PractitionerMembership | null;
      documents: Array<{
        id: string;
        documentType: 'insurance' | 'clinical_registration';
        fileName: string;
        fileUrl: string;
        expiryDate: string | null;
        createdAt: string;
      }>;
      clinicalExecutor: ClinicalExecutor | null;
    }>>(`/admin/practitioners/${userId}/full`);
  },

  // Update practitioner profile
  updatePractitioner: (userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    status?: UserStatus;
  }) => {
    try {
      validateUserId(userId);
    } catch (error) {
      return Promise.reject(error);
    }

    return api.put<ApiResponse<{
      id: string;
      firstName: string;
      lastName: string;
      phone?: string;
      status?: UserStatus;
    }>>(`/admin/practitioners/${userId}`, data);
  },

  // Update next of kin
  updateNextOfKin: (userId: string, data: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  }) => {
    try {
      validateUserId(userId);
    } catch (error) {
      return Promise.reject(error);
    }

    return api.put<ApiResponse<{
      nextOfKin: NextOfKin;
    }>>(`/admin/practitioners/${userId}/next-of-kin`, data);
  },

  // Update clinical executor
  updateClinicalExecutor: (userId: string, data: {
    name: string;
    email: string;
    phone: string;
  }) => {
    try {
      validateUserId(userId);
    } catch (error) {
      return Promise.reject(error);
    }

    return api.put<ApiResponse<ClinicalExecutor>>(`/admin/practitioners/${userId}/clinical-executor`, data);
  },

  // Delete practitioner
  deletePractitioner: (userId: string) => {
    try {
      validateUserId(userId);
    } catch (error) {
      return Promise.reject(error);
    }

    return api.delete<ApiResponse<null>>(`/admin/practitioners/${userId}`);
  },

  // Update document expiry date
  updateDocumentExpiry: (userId: string, documentId: string, expiryDate: string | null) => {
    try {
      validateUserId(userId);
      if (!documentId || typeof documentId !== 'string' || documentId.trim().length === 0) {
        throw new Error(`Invalid documentId parameter: "${documentId}". documentId must be a non-empty string.`);
      }
    } catch (error) {
      return Promise.reject(error);
    }

    return api.put<ApiResponse<{
      id: string;
      documentType: 'insurance' | 'clinical_registration';
      fileName: string;
      expiryDate: string | null;
      isExpired: boolean;
      isExpiringSoon: boolean;
      daysUntilExpiry: number | null;
    }>>(`/admin/practitioners/${userId}/documents/${documentId}/expiry`, {
      expiryDate,
    });
  },
};

export default api;
