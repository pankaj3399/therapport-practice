import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { AccessDenied } from '@/components/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { adminApi } from '@/services/api';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [practitionerCount, setPractitionerCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setStatsError(null);
    try {
      const response = await adminApi.getAdminStats();
      if (response.data.success && response.data.data) {
        setPractitionerCount(response.data.data.practitionerCount);
      }
    } catch (error) {
      console.error('Failed to fetch practitioner count:', error);
      setStatsError('Failed to load statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchStats();
    }
  }, [user]);

  if (user?.role !== 'admin') {
    return <AccessDenied />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage practitioners and memberships
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Practitioners</CardTitle>
              <Icon name="people" className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              {statsError ? (
                <div className="space-y-2">
                  <div className="text-sm text-red-600 dark:text-red-400">{statsError}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchStats}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="text-2xl font-bold">
                  {loading ? '...' : practitionerCount ?? 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              <Icon name="settings" className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/admin/practitioners')}
              >
                <Icon name="people" size={18} className="mr-2" />
                Manage Practitioners
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

