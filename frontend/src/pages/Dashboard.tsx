import { useAuth } from '@/context/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/Icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

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
              Here is your practice overview for <span className="text-slate-800 dark:text-slate-200 font-medium">{currentDate}</span>.
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
              <div className="flex items-baseline gap-1">
                <span className="text-primary text-4xl font-black tracking-tight">£1,250.00</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded w-fit">
                <Icon name="trending_up" size={16} />
                +£150.00 this month
              </div>
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
                <span className="text-slate-900 dark:text-white text-4xl font-black tracking-tight">4.5</span>
                <span className="text-slate-500 font-bold">Hours</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Resets on Nov 1st</p>
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
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Kiosk: Front Desk A</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Check-in: 09:00 AM</p>
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
                      <TableHead>Date & Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Pimlico Room 1</TableCell>
                      <TableCell>Today, 11:00 AM</TableCell>
                      <TableCell>12:00 PM</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Icon name="cancel" size={18} />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Kensington Room 3</TableCell>
                      <TableCell>Tomorrow, 2:00 PM</TableCell>
                      <TableCell>3:30 PM</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Icon name="cancel" size={18} />
                        </Button>
                      </TableCell>
                    </TableRow>
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
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Oct 20, 2023</TableCell>
                      <TableCell>Room Booking - Pimlico Room 1</TableCell>
                      <TableCell className="font-medium">-£25.00</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="success">Completed</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Oct 18, 2023</TableCell>
                      <TableCell>Credit Top-up</TableCell>
                      <TableCell className="font-medium text-green-600 dark:text-green-400">+£100.00</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="success">Completed</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (Compliance Widget) */}
          <div className="xl:col-span-1">
            <Card>
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="flex items-center gap-2">
                  <Icon name="description" className="text-primary" />
                  Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon name="verified" className="text-green-500" />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">Insurance</span>
                    </div>
                    <Badge variant="success">Valid</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon name="verified" className="text-green-500" />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">Registration</span>
                    </div>
                    <Badge variant="success">Valid</Badge>
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
