import { fromZonedTime } from 'date-fns-tz';

/**
 * True if the booking start is at least 24 hours from now.
 * Uses Europe/London to match server; server is source of truth.
 * Returns false for malformed bookingDate or startTimeStr.
 */
export function canCancelBooking(bookingDate: string, startTimeStr: string): boolean {
  const dateParts = bookingDate.split('-');
  if (dateParts.length !== 3) return false;
  const y = Number(dateParts[0]);
  const m = Number(dateParts[1]);
  const d = Number(dateParts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;

  const timePart = startTimeStr.slice(0, 5);
  const timeParts = timePart.split(':');
  if (timeParts.length !== 2) return false;
  const hh = Number(timeParts[0]);
  const mm = Number(timeParts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;

  const bookingStartLocal = new Date(y, m - 1, d, hh, mm, 0);
  const bookingStartTime = bookingStartLocal.getTime();
  if (Number.isNaN(bookingStartTime)) return false;

  const bookingStartUtc = fromZonedTime(bookingStartLocal, 'Europe/London');
  return bookingStartUtc.getTime() - Date.now() >= 24 * 60 * 60 * 1000;
}
