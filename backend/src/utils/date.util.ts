/**
 * Date utility functions for consistent date formatting
 */

/**
 * Formats a Date object to YYYY-MM-01 format (first day of month in UTC)
 * Uses UTC methods to ensure consistent results regardless of server timezone
 * @param date - The date to format (interpreted in UTC)
 * @returns String in format YYYY-MM-01 representing the first day of the month in UTC
 */
export function formatMonthYear(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Calculates expiry status for a document
 * Normalizes dates to UTC midnight and computes expiry information
 * @param expiryDateString - The expiry date as a string or null
 * @returns Object containing isExpired, isExpiringSoon, and daysUntilExpiry
 */
export function calculateExpiryStatus(expiryDateString: string | null): {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
} {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const expiryDate = expiryDateString ? new Date(expiryDateString) : null;
  if (expiryDate) {
    expiryDate.setUTCHours(0, 0, 0, 0);
  }

  const daysUntilExpiry = expiryDate
    ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isExpired = expiryDate ? expiryDate < today : false;
  const isExpiringSoon = expiryDate
    ? !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 30
    : false;

  return {
    isExpired,
    isExpiringSoon,
    daysUntilExpiry,
  };
}

/**
 * Get today's date as YYYY-MM-DD in UTC.
 * Useful for credit expiry comparisons and other date-based logic.
 */
export function todayUtcString(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

/**
 * Get a date N days from today in UTC as YYYY-MM-DD.
 */
export function addDaysUtcString(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Format time from DB (string or Date) to HH:mm for display.
 */
export function formatTimeForEmail(t: string | Date): string {
  if (typeof t === 'string') {
    const parts = t.trim().split(':');
    return `${parts[0] ?? '00'}:${parts[1] ?? '00'}`;
  }
  const d = t as Date;
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
