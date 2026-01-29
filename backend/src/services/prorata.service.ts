/**
 * Pro-rata calculation for mid-month subscription joins.
 * Uses calendar days; credits expire at end of the month they are allocated for.
 */

const MONTHLY_AMOUNT_DEFAULT = ((): number => {
  const raw = process.env.PRORATA_MONTHLY_AMOUNT;
  if (raw === undefined || raw === '') return 105;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 105;
})();

export interface ProrataResult {
  currentMonthAmount: number;
  nextMonthAmount: number;
  currentMonthExpiry: string; // YYYY-MM-DD (last day of current month)
  nextMonthExpiry: string; // YYYY-MM-DD (last day of next month)
}

/**
 * Get last day of month in UTC as YYYY-MM-DD
 */
function getLastDayOfMonth(year: number, month: number): string {
  // month is 0-indexed; last day is day 0 of next month - 1
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const y = lastDay.getUTCFullYear();
  const m = (lastDay.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = lastDay.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculate pro-rata subscription charges for a mid-month join.
 * Formula: (remainingDays / totalDaysInMonth) × monthlyAmount
 * @param joinDate - Date the user joins (time component ignored)
 * @param monthlyAmount - Full month price (e.g. 105)
 * @returns Amounts for current month (pro-rata) and next month (full), plus expiry dates
 */
export function calculateProrataAmount(
  joinDate: Date,
  monthlyAmount: number = MONTHLY_AMOUNT_DEFAULT
): ProrataResult {
  if (!(joinDate instanceof Date) || Number.isNaN(joinDate.getTime())) {
    throw new TypeError('Invalid joinDate');
  }
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
    throw new RangeError('monthlyAmount must be a finite number greater than 0');
  }

  const join = new Date(joinDate);
  // Normalize to midnight UTC so calendar day is stable regardless of time component.
  join.setUTCHours(0, 0, 0, 0);
  const year = join.getUTCFullYear();
  const month = join.getUTCMonth();
  const day = join.getUTCDate();

  const totalDaysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const remainingDays = totalDaysInMonth - day + 1; // join day through end of month, inclusive
  const currentMonthAmount =
    Math.round((remainingDays / totalDaysInMonth) * monthlyAmount * 100) / 100;
  const nextMonthAmount = monthlyAmount;

  const currentMonthExpiry = getLastDayOfMonth(year, month);
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthExpiry = getLastDayOfMonth(nextYear, nextMonth);

  return {
    currentMonthAmount,
    nextMonthAmount,
    currentMonthExpiry,
    nextMonthExpiry,
  };
}
