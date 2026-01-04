/**
 * Date utility functions for consistent date formatting
 */

/**
 * Formats a Date object to YYYY-MM-01 format (first day of month)
 * @param date - The date to format
 * @returns String in format YYYY-MM-01
 */
export function formatMonthYear(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}-01`;
}

