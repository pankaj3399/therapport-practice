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
