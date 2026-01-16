import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { AccessDenied } from '@/components/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Icon } from '@/components/ui/Icon';
import { adminApi } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import axios from 'axios';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [practitionerCount, setPractitionerCount] = useState<number | null>(null);
  const [adHocCount, setAdHocCount] = useState<number | null>(null);
  const [permanentCount, setPermanentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [missingInfo, setMissingInfo] = useState<Array<{ id: string; name: string; missing: string[] }>>([]);
  const [missingInfoLoading, setMissingInfoLoading] = useState(true);
  const [missingInfoError, setMissingInfoError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setStatsError(null);
    try {
      const response = await adminApi.getAdminStats();
      if (response.data.success && response.data.data) {
        setPractitionerCount(response.data.data.practitionerCount);
        setAdHocCount(response.data.data.adHocCount);
        setPermanentCount(response.data.data.permanentCount);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Failed to fetch practitioner count:', {
          message: error.message,
          status: error.response?.status,
          error: error.response?.data?.error,
        });
      } else {
        console.error('Failed to fetch practitioner count:', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      setStatsError('Failed to load statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchMissingInfo = useCallback(async () => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMissingInfoLoading(true);
    setMissingInfoError(null);

    try {
      const response = await adminApi.getPractitionersWithMissingInfo(page, 10, controller.signal);
      if (response.data.success && response.data.data) {
        const { data, pagination } = response.data.data;
        setMissingInfo(data);
        setTotalPages(pagination.totalPages);
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        return;
      }
      console.error('Failed to fetch missing info:', error);
      setMissingInfoError('Failed to load missing information list.');
    } finally {
      if (abortControllerRef.current === controller) { // Only stop loading if this is the latest request
        setMissingInfoLoading(false);
      }
    }
  }, [page]);

  // Separate effect for stats to avoid unnecessary re-fetches when page changes
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchStats();
    }
  }, [user?.role, fetchStats]);

  // Effect for missing info
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchMissingInfo();
    }
    return () => {
      // Cleanup on unmount or dependency change
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user?.role, fetchMissingInfo]);

  if (user?.role !== 'admin') {
    return <AccessDenied />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage members and memberships</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Icon name="people" className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              {statsError ? (
                <div className="space-y-2">
                  <div className="text-sm text-red-600 dark:text-red-400">{statsError}</div>
                  <Button variant="outline" size="sm" onClick={fetchStats}>
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="text-2xl font-bold">{loading ? '...' : practitionerCount ?? 0}</div>
              )}
            </CardContent>
          </Card>


          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Ad-Hoc</CardTitle>
              <Icon name="trending_up" className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              {statsError ? (
                <div className="text-2xl font-bold text-slate-400">—</div>
              ) : (
                <div className="text-2xl font-bold">{loading ? '...' : adHocCount ?? 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Permanent</CardTitle>
              <Icon name="shield" className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              {statsError ? (
                <div className="text-2xl font-bold text-slate-400">—</div>
              ) : (
                <div className="text-2xl font-bold">{loading ? '...' : permanentCount ?? 0}</div>
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
                Manage Members
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Missing Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Icon name="warning" className="text-orange-500" />
              Missing Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Missing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missingInfoLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    </TableRow>
                  ))
                ) : missingInfoError ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8">
                      <div className="text-red-500 mb-2">{missingInfoError}</div>
                      <Button variant="outline" size="sm" onClick={() => fetchMissingInfo()}>
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : missingInfo.length > 0 ? (
                  missingInfo.map((practitioner) => (
                    <TableRow key={practitioner.id}>
                      <TableCell className="font-medium">{practitioner.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {practitioner.missing.map((item, index) => (
                            <span
                              key={index}
                              className={`text-sm ${item.includes('Missing') || item.includes('Incomplete')
                                ? 'text-red-500 font-medium'
                                : item.includes('Expired')
                                  ? 'text-orange-500 font-medium'
                                  : 'text-red-500 font-medium' // Default to missing style
                                }`}
                            >
                              • {item}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-slate-500">
                      No practitioners with missing information found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || missingInfoLoading}
                >
                  Previous
                </Button>
                <div className="text-sm font-medium">
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || missingInfoLoading}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};
