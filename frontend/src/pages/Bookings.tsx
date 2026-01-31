import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Icon } from '@/components/ui/Icon';
import { PaymentModal } from '@/components/payment/PaymentModal';
import {
  practitionerApi,
  type BookingItem,
  type RoomItem,
  type CreditSummary,
} from '@/services/api';
import { fromZonedTime } from 'date-fns-tz';
import { formatDateUK } from '@/lib/utils';

type LocationName = 'Pimlico' | 'Kensington';

const LOCATIONS: LocationName[] = ['Pimlico', 'Kensington'];
/** 30-minute options from 08:00 to 21:30 (start times). */
const TIME_OPTIONS_30MIN = (() => {
  const options: { value: string; label: string }[] = [];
  for (let h = 8; h <= 21; h++) {
    options.push({
      value: `${h.toString().padStart(2, '0')}:00`,
      label: `${h.toString().padStart(2, '0')}:00`,
    });
    if (h <= 21)
      options.push({
        value: `${h.toString().padStart(2, '0')}:30`,
        label: `${h.toString().padStart(2, '0')}:30`,
      });
  }
  return options;
})();

type CalendarBooking = {
  roomId: string;
  startTime: string;
  endTime: string;
  bookerName?: string;
};

/** Maps "HH:mm" to row index 0–27 (08:00 = 0, 21:30 = 27). */
function timeStringToRowIndex(time: string): number {
  const hh = parseInt(time.slice(0, 2), 10);
  const mm = parseInt(time.slice(3, 5), 10);
  return (hh - 8) * 2 + mm / 30;
}

function getRowSpanForBooking(booking: { startTime: string; endTime: string }): number {
  const start = timeStringToRowIndex(booking.startTime);
  const end = timeStringToRowIndex(booking.endTime);
  return Math.max(1, Math.ceil(end - start));
}

function getBookingStartingAtRow(
  bookings: CalendarBooking[],
  roomId: string,
  rowIndex: number
): CalendarBooking | undefined {
  return bookings.find((b) => {
    if (b.roomId !== roomId) return false;
    return Math.floor(timeStringToRowIndex(b.startTime)) === rowIndex;
  });
}

function isRoomCoveredByRowSpan(
  bookings: CalendarBooking[],
  roomId: string,
  rowIndex: number
): boolean {
  return bookings.some((b) => {
    if (b.roomId !== roomId) return false;
    const startRow = Math.floor(timeStringToRowIndex(b.startTime));
    const endRow = Math.ceil(timeStringToRowIndex(b.endTime));
    return startRow < rowIndex && rowIndex < endRow;
  });
}

/** Today's date in local timezone (YYYY-MM-DD). UK/local. */
function todayDateString(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** Max booking date: 1 month from today in local timezone (YYYY-MM-DD). Clamps day to last day of target month to avoid overflow (e.g. Jan 31 → Feb 28). */
function maxBookingDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const targetYear = m === 11 ? y + 1 : y;
  const targetMonthIndex = m === 11 ? 0 : m + 1;
  const lastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  const day = Math.min(d.getDate(), lastDay);
  const target = new Date(targetYear, targetMonthIndex, day);
  return target.toLocaleDateString('en-CA');
}

/** Booking types available to practitioners; admins can also use 'free' and 'internal'. */
const PRACTITIONER_BOOKING_TYPES = [
  { value: 'ad_hoc' as const, label: 'Ad hoc' },
  { value: 'permanent_recurring' as const, label: 'Recurring' },
];
const ALL_BOOKING_TYPES = [
  ...PRACTITIONER_BOOKING_TYPES,
  { value: 'free' as const, label: 'Free' },
  { value: 'internal' as const, label: 'Internal' },
];

export const Bookings: React.FC = () => {
  const { user } = useAuth();
  const postSuccessControllerRef = useRef<AbortController | null>(null);

  const [location, setLocation] = useState<LocationName>('Pimlico');
  const [date, setDate] = useState(todayDateString());
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [credit, setCredit] = useState<CreditSummary | null>(null);
  const [calendarRooms, setCalendarRooms] = useState<Array<{ id: string; name: string }>>([]);
  const [calendarBookings, setCalendarBookings] = useState<
    Array<{ roomId: string; startTime: string; endTime: string; bookerName?: string }>
  >([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingCredit, setLoadingCredit] = useState(false);
  const [quotePrice, setQuotePrice] = useState<number | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentAmountPence, setPaymentAmountPence] = useState<number | undefined>(undefined);
  // Form state
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [bookingType, setBookingType] = useState<
    'ad_hoc' | 'permanent_recurring' | 'free' | 'internal'
  >('ad_hoc');

  const fetchRooms = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingRooms(true);
      try {
        const res = await practitionerApi.getRooms(location, signal);
        if (signal?.aborted) return;
        if (res.data.success && res.data.rooms) {
          setRooms(res.data.rooms);
          setSelectedRoomId(res.data.rooms[0]?.id ?? null);
        }
      } catch (err) {
        if (
          signal?.aborted ||
          (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError'))
        )
          return;
        setRooms([]);
        setSelectedRoomId(null);
      } finally {
        if (!signal?.aborted) setLoadingRooms(false);
      }
    },
    [location]
  );

  const fetchCalendar = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingCalendar(true);
      try {
        const res = await practitionerApi.getCalendar(location, date, signal);
        if (signal?.aborted) return;
        if (res.data.success) {
          setCalendarRooms(res.data.rooms ?? []);
          setCalendarBookings(res.data.bookings ?? []);
        } else {
          setCalendarRooms([]);
          setCalendarBookings([]);
        }
      } catch (err) {
        if (
          signal?.aborted ||
          (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError'))
        )
          return;
        setCalendarRooms([]);
        setCalendarBookings([]);
      } finally {
        if (!signal?.aborted) setLoadingCalendar(false);
      }
    },
    [location, date]
  );

  const fetchBookings = useCallback(async (signal?: AbortSignal) => {
    setLoadingBookings(true);
    try {
      const res = await practitionerApi.getBookings({}, signal);
      if (signal?.aborted) return;
      if (res.data.success && res.data.bookings) {
        setBookings(res.data.bookings);
      } else {
        setBookings([]);
      }
    } catch (err) {
      if (
        signal?.aborted ||
        (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError'))
      )
        return;
      setBookings([]);
    } finally {
      if (!signal?.aborted) setLoadingBookings(false);
    }
  }, []);

  const fetchCredit = useCallback(async (signal?: AbortSignal) => {
    setLoadingCredit(true);
    try {
      const res = await practitionerApi.getCredits(signal);
      if (signal?.aborted) return;
      if (res.data.success && res.data.credit) {
        setCredit(res.data.credit);
      } else {
        setCredit(null);
      }
    } catch (err) {
      if (
        signal?.aborted ||
        (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError'))
      )
        return;
      setCredit(null);
    } finally {
      if (!signal?.aborted) setLoadingCredit(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchRooms(controller.signal);
    return () => controller.abort();
  }, [fetchRooms]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCalendar(controller.signal);
    return () => controller.abort();
  }, [fetchCalendar]);

  useEffect(() => {
    if (!selectedRoomId || endTime <= startTime) {
      setQuotePrice(null);
      return;
    }
    const controller = new AbortController();
    setLoadingQuote(true);
    practitionerApi
      .getBookingQuote(selectedRoomId, date, startTime, endTime, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.data.success && typeof res.data.totalPrice === 'number') {
          setQuotePrice(res.data.totalPrice);
        } else {
          setQuotePrice(null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setQuotePrice(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingQuote(false);
      });
    return () => controller.abort();
  }, [selectedRoomId, date, startTime, endTime]);

  useEffect(() => {
    const controller = new AbortController();
    fetchBookings(controller.signal);
    return () => controller.abort();
  }, [fetchBookings]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCredit(controller.signal);
    return () => controller.abort();
  }, [fetchCredit]);

  useEffect(() => {
    return () => {
      postSuccessControllerRef.current?.abort();
    };
  }, []);

  const bookingTypesForUser =
    user?.role === 'admin' ? ALL_BOOKING_TYPES : PRACTITIONER_BOOKING_TYPES;

  useEffect(() => {
    if (user?.role !== 'admin' && (bookingType === 'free' || bookingType === 'internal')) {
      setBookingType('ad_hoc');
    }
  }, [user?.role, bookingType]);

  const handleCreateBooking = async () => {
    if (!selectedRoomId) {
      setCreateError('Please select a room.');
      return;
    }
    if (endTime <= startTime) {
      setCreateError('End time must be after start time.');
      return;
    }
    setCreateError(null);
    setCreateSuccess(null);
    setSubmitting(true);
    try {
      const res = await practitionerApi.createBooking({
        roomId: selectedRoomId,
        date,
        startTime,
        endTime,
        bookingType: user?.role === 'admin' ? bookingType : 'ad_hoc',
      });
      const data = res.data;
      if (data.success && !data.paymentRequired && data.booking) {
        setCreateSuccess('Booking created.');
        const c = new AbortController();
        postSuccessControllerRef.current = c;
        fetchBookings(c.signal);
        fetchCalendar(c.signal);
        fetchCredit(c.signal);
      } else if (data.success && data.paymentRequired) {
        if (!data.clientSecret) {
          setCreateError('Payment required but payment setup failed. Please try again.');
          return;
        }
        setCreateError(null);
        setPaymentClientSecret(data.clientSecret);
        setPaymentAmountPence(data.amountPence);
        setPaymentModalOpen(true);
      } else if (!data.success) {
        setCreateError(data.error ?? 'Failed to create booking');
      } else {
        setCreateError('Failed to create booking');
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setCreateError(msg ?? 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setCancellingId(id);
    setCancelError(null);
    try {
      await practitionerApi.cancelBooking(id);
      setCancelError(null);
      const c = new AbortController();
      postSuccessControllerRef.current = c;
      fetchBookings(c.signal);
      fetchCalendar(c.signal);
      fetchCredit(c.signal);
    } catch (err) {
      console.error('Cancel booking failed', err);
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setCancelError(msg ?? 'Cancellation failed. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const timeOptions = TIME_OPTIONS_30MIN;

  const today = useMemo(() => todayDateString(), []);
  const confirmedUpcoming = bookings.filter(
    (b) => b.status === 'confirmed' && b.bookingDate >= today
  );

  /** True if the booking start is at least 24 hours from now. Uses Europe/London to match server; server is source of truth. */
  const canCancelBooking = (bookingDate: string, startTimeStr: string): boolean => {
    const [y, m, d] = bookingDate.split('-').map(Number);
    const timePart = startTimeStr.slice(0, 5);
    const [hh, mm] = timePart.split(':').map(Number);
    const bookingStartLocal = new Date(y, m - 1, d, hh, mm, 0);
    const bookingStartUtc = fromZonedTime(bookingStartLocal, 'Europe/London');
    return bookingStartUtc.getTime() - Date.now() >= 24 * 60 * 60 * 1000;
  };

  const handlePaymentModalOpenChange = (open: boolean) => {
    setPaymentModalOpen(open);
    if (!open) {
      setPaymentClientSecret(null);
      setPaymentAmountPence(undefined);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentModalOpen(false);
    setPaymentClientSecret(null);
    setPaymentAmountPence(undefined);
    setCreateSuccess('Booking created.');
    setCreateError(null);
    const c = new AbortController();
    postSuccessControllerRef.current = c;
    fetchBookings(c.signal);
    fetchCalendar(c.signal);
    fetchCredit(c.signal);
  };

  return (
    <MainLayout>
      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={handlePaymentModalOpenChange}
        clientSecret={paymentClientSecret}
        amountPence={paymentAmountPence}
        onSuccess={handlePaymentSuccess}
        title="Pay the difference to complete your booking"
      />
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bookings</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            View the calendar, create bookings, and manage your schedule.
          </p>
        </div>

        {/* Credit summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Icon name="account_balance_wallet" className="text-primary" />
              Credit balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCredit ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : credit?.currentMonth ? (
              <p className="text-lg font-bold text-primary">
                £{credit.currentMonth.remainingCredit.toFixed(2)} available
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
                  ({credit.currentMonth.monthYear})
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                {credit?.membershipType === 'permanent'
                  ? 'Permanent membership — no credit balance.'
                  : 'No credit data.'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Calendar: location, date, day grid with rooms as columns */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex gap-2">
                {LOCATIONS.map((loc) => (
                  <Button
                    key={loc}
                    variant={location === loc ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLocation(loc)}
                  >
                    {loc}
                  </Button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Date</span>
                <input
                  type="date"
                  value={date}
                  min={today}
                  max={maxBookingDateString()}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            </div>
            {loadingRooms ? (
              <p className="text-sm text-slate-500">Loading rooms…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Room:</span>
                {rooms.map((r) => (
                  <Button
                    key={r.id}
                    variant={selectedRoomId === r.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedRoomId(r.id)}
                  >
                    {r.name}
                  </Button>
                ))}
              </div>
            )}
            {loadingCalendar ? (
              <p className="text-sm text-slate-500">Loading calendar…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[400px] text-sm">
                  <thead>
                    <tr>
                      <th className="border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1.5 text-left text-xs font-medium text-slate-600 dark:text-slate-400 w-[60px]">
                        Time
                      </th>
                      {calendarRooms.map((r) => (
                        <th
                          key={r.id}
                          className="border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1.5 text-center text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          {r.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 28 }, (_, i) => {
                      const h = 8 + Math.floor(i / 2);
                      const m = (i % 2) * 30;
                      const timeLabel = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                      return (
                        <tr key={i}>
                          <td className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs text-slate-500 dark:text-slate-400 align-top">
                            {timeLabel}
                          </td>
                          {calendarRooms.map((room) => {
                            if (isRoomCoveredByRowSpan(calendarBookings, room.id, i)) return null;
                            const bookingStartingHere = getBookingStartingAtRow(
                              calendarBookings,
                              room.id,
                              i
                            );
                            if (bookingStartingHere) {
                              const rowSpan = getRowSpanForBooking(bookingStartingHere);
                              return (
                                <td
                                  key={room.id}
                                  rowSpan={rowSpan}
                                  className="border border-slate-200 dark:border-slate-700 bg-primary/20 dark:bg-primary/30 border-primary/40 p-1 align-top"
                                >
                                  <span className="text-xs truncate block">
                                    {user?.role === 'admin' && bookingStartingHere.bookerName
                                      ? bookingStartingHere.bookerName
                                      : ' '}
                                  </span>
                                </td>
                              );
                            }
                            return (
                              <td
                                key={room.id}
                                className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 min-h-[14px]"
                              />
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create booking form */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Booking for {formatDateUK(date)}
            </p>
            <div className="flex flex-wrap gap-4 items-end">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Start</span>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  {timeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-600 dark:text-slate-400">End</span>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  {timeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {user?.role === 'admin' && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Type</span>
                  <select
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value as typeof bookingType)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    {bookingTypesForUser.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Price:{' '}
                  {loadingQuote ? '—' : quotePrice != null ? `£${quotePrice.toFixed(2)}` : '—'}
                </span>
                <Button onClick={handleCreateBooking} disabled={submitting || !selectedRoomId}>
                  {submitting ? 'Creating…' : 'Create booking'}
                </Button>
              </div>
            </div>
            {createError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {createError}
              </p>
            )}
            {createSuccess && (
              <output
                className="block text-sm text-green-600 dark:text-green-400"
                aria-live="polite"
              >
                {createSuccess}
              </output>
            )}
          </CardContent>
        </Card>

        {/* My bookings list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Cancellation with less than 24 hours notice is not permitted.
            </p>
            {cancelError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4" role="alert">
                {cancelError}
              </p>
            )}
            {loadingBookings ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : confirmedUpcoming.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming confirmed bookings.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmedUpcoming.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{formatDateUK(b.bookingDate)}</TableCell>
                      <TableCell>
                        {b.roomName} ({b.locationName})
                      </TableCell>
                      <TableCell>
                        {b.startTime.slice(0, 5)} – {b.endTime.slice(0, 5)}
                      </TableCell>
                      <TableCell>£{b.totalPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelBooking(b.id)}
                          disabled={
                            cancellingId === b.id || !canCancelBooking(b.bookingDate, b.startTime)
                          }
                          className="text-red-600 hover:text-red-700"
                          title={
                            !canCancelBooking(b.bookingDate, b.startTime)
                              ? 'Cancellation with less than 24 hours notice is not permitted'
                              : undefined
                          }
                        >
                          {cancellingId === b.id ? 'Cancelling…' : 'Cancel'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};
