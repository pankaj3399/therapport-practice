/**
 * Pricing engine for room bookings.
 * Weekend and rate bands use Europe/London timezone.
 * Morning = 08:00–15:00, Afternoon = 15:00–22:00. Booking window 08:00–22:00 same day.
 */

import { toZonedTime } from 'date-fns-tz';

export type LocationName = 'Pimlico' | 'Kensington';

// £ per hour by location and band
const RATES: Record<
  LocationName,
  { weekday: { morning: number; afternoon: number }; weekend: number }
> = {
  Kensington: { weekday: { morning: 19, afternoon: 23 }, weekend: 14 },
  Pimlico: { weekday: { morning: 15, afternoon: 20 }, weekend: 13 },
};

/**
 * Parse time string "HH:mm" or "HH:mm:ss" to hours (fractional).
 * Minutes are required; seconds optional. Hours 0–23 (or 24:00:00 for end-of-day), minutes and seconds 0–59.
 * Invalid input throws.
 * @throws {Error} Invalid time format: ${timeStr}
 */
function parseTimeToHours(timeStr: string): number {
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error(`Invalid time format: ${timeStr}`);
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = match[3] ? parseInt(match[3], 10) : 0;
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s))
    throw new Error(`Invalid time format: ${timeStr}`);
  if (h < 0 || h > 24 || m < 0 || m > 59 || s < 0 || s > 59)
    throw new Error(`Invalid time format: ${timeStr}`);
  if (h === 24 && (m !== 0 || s !== 0)) throw new Error(`Invalid time format: ${timeStr}`);
  return h + m / 60 + s / 3600;
}

/**
 * Check if date is weekend (Saturday = 6, Sunday = 0) in Europe/London.
 */
function isWeekend(date: Date): boolean {
  const zoned = toZonedTime(date, 'Europe/London');
  const day = zoned.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

/**
 * Get price per hour for a given location, date, and time.
 * Time is used to determine morning (08:00–15:00) vs afternoon (15:00–22:00).
 */
export function calculatePricePerHour(location: LocationName, date: Date, time: string): number {
  const rates = RATES[location];
  if (isWeekend(date)) return rates.weekend;
  const hours = parseTimeToHours(time);
  if (hours < 8 || hours > 22) {
    throw new Error('Booking time outside allowed window 08:00–22:00');
  }
  // Morning: 8–15 (8.0 to 14.999...), Afternoon: 15–22
  if (hours >= 8 && hours < 15) return rates.weekday.morning;
  if (hours >= 15 && hours < 22) return rates.weekday.afternoon;
  // 22:00 is the end of the booking window, not a valid start time for billing.
  throw new Error('Booking time outside allowed window 08:00–22:00');
}

/**
 * Calculate total price for a booking span.
 * Splits by hour and applies the correct rate per hour (handles morning/afternoon boundary).
 * @throws {Error} Invalid booking span when end time <= start time (overnight not supported).
 * @throws {Error} Invalid time format when start/end time strings are invalid.
 */
export function calculateTotalPrice(
  location: LocationName,
  date: Date,
  startTime: string,
  endTime: string
): number {
  const startHours = parseTimeToHours(startTime);
  const endHours = parseTimeToHours(endTime);
  if (startHours < 8 || endHours > 22) {
    throw new Error('Bookings must be within the 08:00–22:00 window');
  }
  // Overnight or reversed spans are invalid; booking window is 08:00–22:00 same day.
  if (endHours <= startHours) {
    throw new Error(
      'Invalid booking span: end time must be after start time within the same day (overnight bookings are not supported)'
    );
  }
  const rates = RATES[location];
  const isSatSun = isWeekend(date);
  let total = 0;
  // Walk the span by segments up to the next band boundary (15:00, 22:00),
  // so fractional crossings (e.g. 14:30–15:30) are billed correctly.
  let h = startHours;
  while (h < endHours) {
    let nextBoundary = endHours;
    if (!isSatSun) {
      if (h < 15 && endHours > 15) {
        nextBoundary = Math.min(endHours, 15);
      } else {
        nextBoundary = Math.min(endHours, 22);
      }
    }
    const segmentEnd = nextBoundary;
    const segmentHours = segmentEnd - h;
    let rate: number;
    if (isSatSun) {
      rate = rates.weekend;
    } else {
      if (h >= 8 && h < 15) {
        rate = rates.weekday.morning;
      } else if (h >= 15 && h < 22) {
        rate = rates.weekday.afternoon;
      } else {
        // Should not occur due to window validation, but guard defensively.
        throw new Error('Booking segment outside allowed window 08:00–22:00');
      }
    }
    total += rate * segmentHours;
    h = segmentEnd;
  }
  return Math.round(total * 100) / 100;
}
