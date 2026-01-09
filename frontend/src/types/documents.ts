export interface DocumentData {
  id: string;
  fileName: string;
  expiryDate: string;
  documentUrl: string;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  daysUntilExpiry?: number | null;
}
