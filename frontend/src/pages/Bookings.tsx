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
  type BookingSlot,
  type CreditSummary,
} from '@/services/api';
import { formatDateUK, cn } from '@/lib/utils';

type LocationName = 'Pimlico' | 'Kensington';

const LOCATIONS: LocationName[] = ['Pimlico', 'Kensington'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00 - 21:00

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
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [credit, setCredit] = useState<CreditSummary | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingCredit, setLoadingCredit] = useState(false);
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

  const fetchSlots = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedRoomId) {
        setSlots([]);
        return;
      }
      setLoadingSlots(true);
      try {
        const res = await practitionerApi.getBookingAvailability(selectedRoomId, date, signal);
        if (signal?.aborted) return;
        if (res.data.success && res.data.slots) {
          setSlots(res.data.slots);
        } else {
          setSlots([]);
        }
      } catch (err) {
        if (
          signal?.aborted ||
          (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError'))
        )
          return;
        setSlots([]);
      } finally {
        if (!signal?.aborted) setLoadingSlots(false);
      }
    },
    [selectedRoomId, date]
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
    fetchSlots(controller.signal);
    return () => controller.abort();
  }, [fetchSlots]);

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
        bookingType,
      });
      const data = res.data;
      if (data.success && !data.paymentRequired && data.booking) {
        setCreateSuccess('Booking created.');
        const c = new AbortController();
        postSuccessControllerRef.current = c;
        fetchBookings(c.signal);
        fetchSlots(c.signal);
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
      fetchSlots(c.signal);
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

  const timeOptions = HOURS.map((h) => {
    const t = `${h.toString().padStart(2, '0')}:00`;
    return { value: t, label: t };
  });

  const today = useMemo(() => todayDateString(), []);
  const confirmedUpcoming = bookings.filter(
    (b) => b.status === 'confirmed' && b.bookingDate >= today
  );

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
    fetchSlots(c.signal);
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
            View availability, create bookings, and manage your schedule.
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

        {/* Location & date */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Availability</CardTitle>
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
            {loadingSlots && selectedRoomId ? (
              <p className="text-sm text-slate-500">Loading slots…</p>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {slots.map((slot) => (
                  <div
                    key={slot.startTime}
                    className={cn(
                      'rounded px-2 py-1 text-xs text-center',
                      slot.available
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    )}
                  >
                    {slot.startTime}
                  </div>
                ))}
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
              <Button onClick={handleCreateBooking} disabled={submitting || !selectedRoomId}>
                {submitting ? 'Creating…' : 'Create booking'}
              </Button>
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
                          disabled={cancellingId === b.id}
                          className="text-red-600 hover:text-red-700"
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
