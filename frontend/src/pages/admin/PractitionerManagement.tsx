import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/Icon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi } from '@/services/api';
import { cn } from '@/lib/utils';

interface Practitioner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  membership: {
    type: 'permanent' | 'ad_hoc';
    marketingAddon: boolean;
  } | null;
}

interface PractitionerDetail extends Practitioner {
  phone?: string;
  role: string;
  membership: {
    id: string;
    type: 'permanent' | 'ad_hoc';
    marketingAddon: boolean;
  } | null;
}

export const PractitionerManagement: React.FC = () => {
  const { user } = useAuth();
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<PractitionerDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Membership form state
  const [membershipType, setMembershipType] = useState<'permanent' | 'ad_hoc' | ''>('');
  const [marketingAddon, setMarketingAddon] = useState(false);

  useEffect(() => {
    fetchPractitioners();
  }, []);

  useEffect(() => {
    if (selectedPractitioner) {
      setMembershipType(selectedPractitioner.membership?.type || '');
      setMarketingAddon(selectedPractitioner.membership?.marketingAddon || false);
    }
  }, [selectedPractitioner]);

  const fetchPractitioners = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getPractitioners(searchQuery || undefined);
      if (response.data.success && response.data.data) {
        setPractitioners(response.data.data);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to load practitioners',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchPractitioners();
  };

  const handleSelectPractitioner = async (practitionerId: string) => {
    try {
      const response = await adminApi.getPractitioner(practitionerId);
      if (response.data.success && response.data.data) {
        setSelectedPractitioner(response.data.data);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to load practitioner details',
      });
    }
  };

  const handleSaveMembership = async () => {
    if (!selectedPractitioner) return;

    // Validate marketing add-on can only be enabled for permanent members
    if (marketingAddon && membershipType !== 'permanent') {
      setMessage({
        type: 'error',
        text: 'Marketing add-on can only be enabled for permanent members',
      });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const updateData: {
        type?: 'permanent' | 'ad_hoc';
        marketingAddon?: boolean;
      } = {};

      if (membershipType) {
        updateData.type = membershipType as 'permanent' | 'ad_hoc';
      }

      if (selectedPractitioner.membership) {
        // Only update marketing add-on if it changed
        if (marketingAddon !== selectedPractitioner.membership.marketingAddon) {
          updateData.marketingAddon = marketingAddon;
        }
      } else {
        // Creating new membership, include marketing add-on
        updateData.marketingAddon = marketingAddon;
      }

      const response = await adminApi.updateMembership(selectedPractitioner.id, updateData);
      if (response.data.success && response.data.data) {
        setMessage({ type: 'success', text: 'Membership updated successfully' });
        // Refresh practitioner list and details
        await fetchPractitioners();
        await handleSelectPractitioner(selectedPractitioner.id);
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to update membership',
      });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-red-500">Access denied. Admin role required.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Practitioner Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            View and manage practitioner memberships
          </p>
        </div>

        {message && (
          <div
            className={cn(
              'p-4 rounded-lg',
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
            )}
          >
            {message.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Practitioner List */}
          <Card>
            <CardHeader>
              <CardTitle>Practitioners</CardTitle>
              <CardDescription>Search and select a practitioner to manage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  <Icon name="search" size={18} className="mr-2" />
                  Search
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-slate-500">Loading...</div>
              ) : practitioners.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No practitioners found</div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Membership</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {practitioners.map((practitioner) => (
                        <TableRow
                          key={practitioner.id}
                          className={cn(
                            'cursor-pointer',
                            selectedPractitioner?.id === practitioner.id && 'bg-slate-50 dark:bg-slate-900'
                          )}
                          onClick={() => handleSelectPractitioner(practitioner.id)}
                        >
                          <TableCell>
                            {practitioner.firstName} {practitioner.lastName}
                          </TableCell>
                          <TableCell>{practitioner.email}</TableCell>
                          <TableCell>
                            {practitioner.membership ? (
                              <div className="flex gap-2">
                                <Badge variant="outline">{practitioner.membership.type}</Badge>
                                {practitioner.membership.marketingAddon && (
                                  <Badge variant="success">Marketing</Badge>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline">No membership</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectPractitioner(practitioner.id);
                              }}
                            >
                              <Icon name="edit" size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Membership Editor */}
          <Card>
            <CardHeader>
              <CardTitle>Membership Details</CardTitle>
              <CardDescription>
                {selectedPractitioner
                  ? `Edit membership for ${selectedPractitioner.firstName} ${selectedPractitioner.lastName}`
                  : 'Select a practitioner to edit their membership'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedPractitioner ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="membershipType">Membership Type</Label>
                    <select
                      id="membershipType"
                      value={membershipType}
                      onChange={(e) => {
                        const newType = e.target.value as 'permanent' | 'ad_hoc' | '';
                        setMembershipType(newType);
                        // If changing to ad_hoc, disable marketing add-on
                        if (newType === 'ad_hoc') {
                          setMarketingAddon(false);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
                      disabled={saving}
                    >
                      <option value="">No membership</option>
                      <option value="permanent">Permanent</option>
                      <option value="ad_hoc">Ad-hoc</option>
                    </select>
                  </div>

                  {membershipType === 'permanent' && (
                    <div className="space-y-2">
                      <Label htmlFor="marketingAddon" className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="marketingAddon"
                          checked={marketingAddon}
                          onChange={(e) => setMarketingAddon(e.target.checked)}
                          disabled={saving}
                          className="w-4 h-4"
                        />
                        <span>Enable Marketing Add-on</span>
                      </Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Marketing add-on is only available for permanent members
                      </p>
                    </div>
                  )}

                  {membershipType === 'ad_hoc' && marketingAddon && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                      Marketing add-on will be disabled when membership type is set to ad-hoc
                    </div>
                  )}

                  <Button
                    onClick={handleSaveMembership}
                    disabled={saving || !membershipType}
                    className="w-full"
                  >
                    {saving ? 'Saving...' : 'Save Membership'}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Select a practitioner from the list to edit their membership
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

