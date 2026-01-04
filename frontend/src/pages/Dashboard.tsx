import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
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
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/Icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDateUK } from '@/lib/utils';
import api from '@/services/api';

interface DashboardData {
  freeBookingHours: {
    remaining: number;
    totalAllocated: number;
    totalUsed: number;
    earliestExpiry: string | null;
  };
  credit: {
    currentMonth: {
      monthYear: string;
      monthlyCredit: number;
      usedCredit: number;
      remainingCredit: number;
    } | null;
    nextMonth: {
      monthYear: string;
      monthlyCredit: number;
    } | null;
    membershipType: 'permanent' | 'ad_hoc' | null;
  };
  upcomingBookings: Array<{
    id: string;
    roomName: string;
    locationName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    totalPrice: number;
    status: string;
  }>;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || 'U';
  };

  const currentDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const fetchDashboardData = async (signal?: AbortSignal) => {
    try {
      if (!isMountedRef.current) return;
      setLoading(true);
      setError(null);
      const response = await api.get<{ success: boolean; data: DashboardData }>(
        '/practitioner/dashboard',
        {
          signal,
        }
      );
      if (!signal?.aborted && isMountedRef.current && response.data.success && response.data.data) {
        setDashboardData(response.data.data);
      }
    } catch (err: any) {
      // Don't set error if request was aborted or component unmounted
      if (!signal?.aborted && isMountedRef.current) {
        setError(err.response?.data?.error || 'Failed to load dashboard data');
      }
    } finally {
      if (!signal?.aborted && isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!user) return;

    isMountedRef.current = true;
    const controller = new AbortController();
    fetchDashboardData(controller.signal);

    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, [user]);

  const formatMonthYear = (monthYear: string): string => {
    // Validate input: non-empty string matching YYYY-MM format
    if (!monthYear || typeof monthYear !== 'string' || !/^\d{4}-\d{2}$/.test(monthYear)) {
      return '';
    }

    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // Verify parsed numbers are finite
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return '';
    }

    // Validate date is valid (not NaN)
    const date = new Date(year, month - 1, 1);
    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const formatExpiryDate = (dateStr: string | null): string => {
    if (!dateStr) return '';

    try {
      const date = new Date(dateStr);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatTime = (timeStr: string): string => {
    // Guard against falsy or non-string inputs
    if (!timeStr || typeof timeStr !== 'string') {
      return '';
    }

    // Split and trim the input
    const parts = timeStr.split(':').map((part) => part.trim());

    // Ensure we have at least hours, default minutes to "00" if missing
    if (parts.length === 0) {
      return '';
    }

    const hoursStr = parts[0] || '';
    const minutesStr = parts[1] || '00';

    // Validate parseInt results
    const hour = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (isNaN(hour) || isNaN(minutes)) {
      return '';
    }

    // Compute AM/PM and displayHour using validated numeric values
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatBookingDate = (dateStr: string): string => {
    const date = new Date(dateStr);

    // Validate date is valid
    if (isNaN(date.getTime())) {
      return '';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate.getTime() === today.getTime()) {
      return 'Today';
    }
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (bookingDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-red-500">{error}</p>
          <Button onClick={() => fetchDashboardData()} disabled={loading} variant="outline">
            {loading ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Page Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">
              Welcome back, {user?.firstName}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-base font-normal">
              Here is your overview for{' '}
              <span className="text-slate-800 dark:text-slate-200 font-medium">{currentDate}</span>.
            </p>
          </div>
          <Button>
            <Icon name="add" size={20} className="mr-2" />
            Book a Room
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Credit Balance */}
          <Card className="relative overflow-hidden group h-40">
            <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Icon name="account_balance_wallet" className="text-6xl text-primary" />
            </div>
            <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
              <p className="text-slate-500 dark:text-slate-400 font-medium">Credit Balance</p>
              {dashboardData?.credit.currentMonth ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-slate-900 dark:text-white text-3xl font-black tracking-tight">
                      £{dashboardData.credit.currentMonth.remainingCredit.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatMonthYear(dashboardData.credit.currentMonth.monthYear)} • Used: £
                    {dashboardData.credit.currentMonth.usedCredit.toFixed(2)} / £
                    {dashboardData.credit.currentMonth.monthlyCredit.toFixed(2)}
                  </p>
                  {dashboardData.credit.nextMonth && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                      Next month: £{dashboardData.credit.nextMonth.monthlyCredit.toFixed(2)}{' '}
                      available
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {dashboardData?.credit.membershipType === 'permanent'
                      ? 'Permanent membership'
                      : 'No credit balance'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Free Booking Hours */}
          <Card className="relative overflow-hidden group h-40">
            <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Icon name="timer" className="text-6xl text-orange-500" />
            </div>
            <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
              <p className="text-slate-500 dark:text-slate-400 font-medium">Free Booking Hours</p>
              <div className="flex items-baseline gap-1">
                <span className="text-slate-900 dark:text-white text-4xl font-black tracking-tight">
                  {dashboardData?.freeBookingHours.remaining.toFixed(1) || '0.0'}
                </span>
                <span className="text-slate-500 font-bold">Hours</span>
              </div>
              {dashboardData?.freeBookingHours.earliestExpiry ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  Expires: {formatExpiryDate(dashboardData.freeBookingHours.earliestExpiry)}
                </p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  No active vouchers
                </p>
              )}
            </CardContent>
          </Card>

          {/* Kiosk Status */}
          <Card className="col-span-1 md:col-span-2 lg:col-span-1">
            <CardContent className="p-5 flex flex-row items-center gap-4">
              <div className="relative">
                <Avatar className="h-28 w-28 border-2 border-green-500">
                  <AvatarImage src="" alt="Kiosk check-in photo" />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                    {getInitials(user?.firstName, user?.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1 rounded-full border-2 border-white dark:border-surface-dark">
                  <Icon name="check" size={16} />
                </div>
              </div>
              <div className="flex flex-col flex-1 gap-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-900 dark:text-white font-bold text-lg">Signed In</p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Pimlico Tablet</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                      Check-in: 09:00 AM
                    </p>
                  </div>
                </div>
                <Button variant="destructive" size="sm" className="mt-2 w-full">
                  <Icon name="logout" size={18} className="mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Columns */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column (Data Tables) */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            {/* Upcoming Bookings */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="flex items-center gap-2">
                  <Icon name="event_available" className="text-primary" />
                  Upcoming Bookings
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-sm font-bold text-primary">
                  View All
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right">Cancel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData?.upcomingBookings &&
                    dashboardData.upcomingBookings.length > 0 ? (
                      dashboardData.upcomingBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">
                            {booking.roomName} ({booking.locationName})
                          </TableCell>
                          <TableCell>{formatBookingDate(booking.bookingDate)}</TableCell>
                          <TableCell>{formatTime(booking.startTime)}</TableCell>
                          <TableCell>{formatTime(booking.endTime)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <Icon name="cancel" size={18} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-slate-500 dark:text-slate-400 py-8"
                        >
                          No upcoming bookings
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="flex items-center gap-2">
                  <Icon name="receipt" className="text-primary" />
                  Recent Transactions
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-sm font-bold text-primary">
                  View All
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Receipts</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{formatDateUK(new Date('2023-10-20'))}</TableCell>
                      <TableCell>Room Booking - Pimlico Room 1</TableCell>
                      <TableCell className="font-medium">-£25.00</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" disabled>
                          <Icon name="download" size={16} className="mr-1" />
                          Download
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="success">Completed</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>{formatDateUK(new Date('2023-10-18'))}</TableCell>
                      <TableCell>Credit Top-up</TableCell>
                      <TableCell className="font-medium text-green-600 dark:text-green-400">
                        +£100.00
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" disabled>
                          <Icon name="download" size={16} className="mr-1" />
                          Download
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="success">Completed</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (Documents Widget) */}
          <div className="xl:col-span-1">
            <Card>
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="flex items-center gap-2">
                  <Icon name="description" className="text-primary" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon name="verified" className="text-green-500" />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        Insurance
                      </span>
                    </div>
                    <Badge variant="success" className="text-center">
                      Valid until 30.09.2026
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon name="verified" className="text-green-500" />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        Registration
                      </span>
                    </div>
                    <Badge variant="success" className="text-center">
                      Valid until 30.09.2026
                    </Badge>
                  </div>
                  <Button variant="outline" className="w-full">
                    <Icon name="upload" size={18} className="mr-2" />
                    Upload Documents
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
