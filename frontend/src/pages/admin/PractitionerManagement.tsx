import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { AccessDenied } from '@/components/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/Icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ProfileTab } from './components/ProfileTab';
import { MembershipTab } from './components/MembershipTab';
import { NextOfKinTab } from './components/NextOfKinTab';
import { ClinicalTab } from './components/ClinicalTab';
import { UserStatus, PractitionerMembership, NextOfKin, ClinicalExecutor, PractitionerDocument } from '@/types';

const statusColors: Record<UserStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    active: 'bg-green-100 text-green-700 border-green-200',
    suspended: 'bg-orange-100 text-orange-800 border-orange-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
};

interface Practitioner {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
    membership: PractitionerMembership | null;
}

interface FullPractitioner {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: string;
    status: UserStatus;
    membership: PractitionerMembership | null;
    nextOfKin: NextOfKin | null;
    documents: PractitionerDocument[];
    clinicalExecutor: ClinicalExecutor | null;
}


export const PractitionerManagement: React.FC = () => {
    const { user } = useAuth();
    const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;
    const [selectedPractitioner, setSelectedPractitioner] = useState<FullPractitioner | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const detailPanelRef = useRef<HTMLDivElement>(null);

    // Form states
    const [profileForm, setProfileForm] = useState<{ firstName: string; lastName: string; phone: string; status: UserStatus }>({ firstName: '', lastName: '', phone: '', status: 'pending' });
    const [membershipType, setMembershipType] = useState<'permanent' | 'ad_hoc' | ''>('');
    const [marketingAddon, setMarketingAddon] = useState(false);
    const [nextOfKinForm, setNextOfKinForm] = useState({ name: '', relationship: '', phone: '', email: '' });
    const [clinicalExecutorForm, setClinicalExecutorForm] = useState({ name: '', email: '', phone: '' });

    const setMessageWithTimeout = useCallback(
        (msg: { type: 'success' | 'error'; text: string } | null, timeoutMs = 3000) => {
            if (messageTimeoutRef.current) {
                clearTimeout(messageTimeoutRef.current);
                messageTimeoutRef.current = null;
            }
            setMessage(msg);
            if (msg && msg.type === 'success') {
                messageTimeoutRef.current = setTimeout(() => setMessage(null), timeoutMs);
            }
        },
        []
    );

    const fetchPractitioners = useCallback(async () => {
        try {
            setLoading(true);
            const response = await adminApi.getPractitioners(searchQuery, page, limit);
            if (response.data?.success) {
                setPractitioners(response.data.data || []);
                // Access pagination from the intersection type properties
                if (response.data.pagination) {
                    setTotalPages(response.data.pagination.totalPages);
                }
            }
        } catch (error: any) {
            setMessageWithTimeout({ type: 'error', text: error.response?.data?.error || 'Failed to load practitioners' });
        } finally {
            setLoading(false);
        }
    }, [searchQuery, page, limit, setMessageWithTimeout]);

    // Reset page when search query changes
    useEffect(() => {
        setPage(1);
    }, [searchQuery]);

    // Clamp page if totalPages reduces (e.g. after search/filter)
    useEffect(() => {
        if (totalPages > 0 && page > totalPages) {
            setPage(totalPages);
        }
    }, [totalPages, page]);

    useEffect(() => {
        fetchPractitioners();
    }, [fetchPractitioners]);

    useEffect(() => {
        return () => {
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
        };
    }, []);

    // Update form states when practitioner is selected
    useEffect(() => {
        if (selectedPractitioner) {
            setProfileForm({
                firstName: selectedPractitioner.firstName,
                lastName: selectedPractitioner.lastName,
                phone: selectedPractitioner.phone || '',
                status: selectedPractitioner.status,
            });
            setMembershipType(selectedPractitioner.membership?.type || '');
            setMarketingAddon(selectedPractitioner.membership?.marketingAddon || false);
            setNextOfKinForm({
                name: selectedPractitioner.nextOfKin?.name || '',
                relationship: selectedPractitioner.nextOfKin?.relationship || '',
                phone: selectedPractitioner.nextOfKin?.phone || '',
                email: selectedPractitioner.nextOfKin?.email || '',
            });
            setClinicalExecutorForm({
                name: selectedPractitioner.clinicalExecutor?.name || '',
                email: selectedPractitioner.clinicalExecutor?.email || '',
                phone: selectedPractitioner.clinicalExecutor?.phone || '',
            });
        }
    }, [selectedPractitioner]);

    // Scroll after paint when selection changes
    useEffect(() => {
        if (selectedPractitioner && detailPanelRef.current) {
            requestAnimationFrame(() => {
                detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }, [selectedPractitioner]);

    const handleSearch = () => fetchPractitioners();

    const handleSelectPractitioner = async (practitionerId: string) => {
        try {
            setDetailLoading(true);
            const response = await adminApi.getFullPractitioner(practitionerId);
            if (response.data.success && response.data.data) {
                // Just update data, scroll effect handles visibility
                setSelectedPractitioner(response.data.data);
                setActiveTab('profile');
            }
        } catch (error: any) {
            setMessageWithTimeout({ type: 'error', text: error.response?.data?.error || 'Failed to load practitioner details' });
            throw error;
        } finally {
            setDetailLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!selectedPractitioner) return;
        try {
            setSaving(true);
            const updateData = {
                firstName: profileForm.firstName,
                lastName: profileForm.lastName,
                phone: profileForm.phone || undefined,
                status: profileForm.status,
            };
            await adminApi.updatePractitioner(selectedPractitioner.id, updateData);
            setMessageWithTimeout({ type: 'success', text: 'Profile updated successfully' });

            // Refresh data locally to avoid full reload flicker
            await handleSelectPractitioner(selectedPractitioner.id);
            await fetchPractitioners();
        } catch (error: any) {
            setMessageWithTimeout({ type: 'error', text: error.response?.data?.error || 'Failed to update profile' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveMembership = async () => {
        if (!selectedPractitioner) return;
        if (marketingAddon && membershipType !== 'permanent') {
            setMessageWithTimeout({ type: 'error', text: 'Marketing add-on can only be enabled for permanent members' });
            return;
        }
        try {
            setSaving(true);
            const updateData: { type?: 'permanent' | 'ad_hoc' | null; marketingAddon?: boolean } = {};

            if (membershipType) {
                updateData.type = membershipType;
                updateData.marketingAddon = marketingAddon;
            } else {
                updateData.type = null;
                updateData.marketingAddon = false;
            }

            await adminApi.updateMembership(selectedPractitioner.id, updateData);


            const [updatedPractitioner] = await Promise.all([
                adminApi.getFullPractitioner(selectedPractitioner.id),
                fetchPractitioners()
            ]);

            if (updatedPractitioner.data.success && updatedPractitioner.data.data) {
                setSelectedPractitioner(updatedPractitioner.data.data);
            }
            setMessageWithTimeout({ type: 'success', text: updateData.type === null ? 'Membership removed' : 'Membership updated' });
        } catch (error: any) {
            setMessageWithTimeout({ type: 'error', text: error.response?.data?.error || 'Failed to update membership' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNextOfKin = async () => {
        if (!selectedPractitioner) return;
        try {
            setSaving(true);
            await adminApi.updateNextOfKin(selectedPractitioner.id, nextOfKinForm);
            await handleSelectPractitioner(selectedPractitioner.id);
            setMessageWithTimeout({ type: 'success', text: 'Next of kin updated successfully' });
        } catch (error: any) {
            setMessageWithTimeout({ type: 'error', text: error.response?.data?.error || 'Failed to update next of kin' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveClinicalExecutor = async () => {
        if (!selectedPractitioner) return;
        try {
            setSaving(true);
            await adminApi.updateClinicalExecutor(selectedPractitioner.id, clinicalExecutorForm);
            await handleSelectPractitioner(selectedPractitioner.id);
            setMessageWithTimeout({ type: 'success', text: 'Clinical executor updated successfully' });
        } catch (error: any) {
            setMessageWithTimeout({ type: 'error', text: error.response?.data?.error || 'Failed to update clinical executor' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePractitioner = async () => {
        if (!selectedPractitioner) return;
        try {
            setSaving(true);
            await adminApi.deletePractitioner(selectedPractitioner.id);
            setMessageWithTimeout({ type: 'success', text: 'Practitioner deactivated successfully' });
            setSelectedPractitioner(null);
            await fetchPractitioners();
        } catch (error: any) {
            setMessageWithTimeout({ type: 'error', text: error.response?.data?.error || 'Failed to delete practitioner' });
        } finally {
            setSaving(false);
        }
    };

    if (user?.role !== 'admin') return <AccessDenied />;

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Practitioner Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">View and manage practitioner accounts</p>
                </div>

                {message && (
                    <div className={cn('p-4 rounded-lg', message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200')}>
                        {message.text}
                    </div>
                )}

                {/* Practitioner List - Full Width */}
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
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
                            <>
                                <div className="border rounded-lg overflow-hidden overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-[120px]">Name</TableHead>
                                                <TableHead className="min-w-[150px]">Email</TableHead>
                                                <TableHead className="min-w-[100px]">Membership</TableHead>
                                                <TableHead className="min-w-[70px]">Status</TableHead>
                                                <TableHead className="min-w-[70px]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {practitioners.map((p) => (
                                                <TableRow
                                                    key={p.id}
                                                    className={cn('cursor-pointer', selectedPractitioner?.id === p.id && 'bg-slate-50 dark:bg-slate-900')}
                                                    onClick={() => handleSelectPractitioner(p.id)}
                                                >
                                                    <TableCell className="font-medium">{p.firstName} {p.lastName}</TableCell>
                                                    <TableCell className="text-sm text-slate-500">{p.email}</TableCell>
                                                    <TableCell>
                                                        {p.membership ? (
                                                            <div className="flex gap-1">
                                                                <Badge variant="outline">{p.membership.type}</Badge>
                                                                {p.membership.marketingAddon && <Badge variant="success">M</Badge>}
                                                            </div>
                                                        ) : (
                                                            <Badge variant="outline">None</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={statusColors[p.status] || 'bg-slate-100'}>
                                                            {p.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSelectPractitioner(p.id);
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

                                {/* Pagination Controls */}
                                <div className="flex items-center justify-between p-4 border-t">
                                    <div className="text-sm text-slate-500 text-muted-foreground w-full">
                                        <div className='w-full flex justify-between items-center'>
                                            <div>
                                                Page {page} of {totalPages}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                    disabled={page <= 1 || totalPages === 0 || loading}
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                                    disabled={page >= totalPages || totalPages === 0 || loading}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Practitioner Detail Panel - Only shown when selected */}
                {selectedPractitioner && (
                    <div ref={detailPanelRef}>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>
                                        {selectedPractitioner.firstName} {selectedPractitioner.lastName}
                                    </CardTitle>
                                    <CardDescription>
                                        {selectedPractitioner.email}
                                    </CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedPractitioner(null)}>
                                    <Icon name="x" size={18} />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {detailLoading ? (
                                    <div className="text-center py-8 text-slate-500">Loading details...</div>
                                ) : (
                                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                                        <TabsList className="grid w-full grid-cols-4">
                                            <TabsTrigger value="profile">Profile</TabsTrigger>
                                            <TabsTrigger value="membership">Membership</TabsTrigger>
                                            <TabsTrigger value="nextofkin">Next of Kin</TabsTrigger>
                                            <TabsTrigger value="clinical">Clinical</TabsTrigger>
                                        </TabsList>

                                        {/* Profile Tab */}
                                        <TabsContent value="profile" className="mt-0">
                                            <ProfileTab
                                                firstName={profileForm.firstName}
                                                lastName={profileForm.lastName}
                                                phone={profileForm.phone}
                                                status={profileForm.status}
                                                saving={saving}
                                                onChange={setProfileForm}
                                                onSave={handleSaveProfile}
                                                onDelete={handleDeletePractitioner}
                                                practitionerName={`${selectedPractitioner.firstName} ${selectedPractitioner.lastName}`}
                                            />
                                        </TabsContent>

                                        {/* Membership Tab */}
                                        <TabsContent value="membership" className="mt-0">
                                            <MembershipTab
                                                membershipType={membershipType}
                                                marketingAddon={marketingAddon}
                                                saving={saving}
                                                onTypeChange={setMembershipType}
                                                onAddonChange={setMarketingAddon}
                                                onSave={handleSaveMembership}
                                            />
                                        </TabsContent>

                                        {/* Next of Kin Tab */}
                                        <TabsContent value="nextofkin" className="mt-0">
                                            <NextOfKinTab
                                                form={nextOfKinForm}
                                                saving={saving}
                                                onChange={setNextOfKinForm}
                                                onSave={handleSaveNextOfKin}
                                            />
                                        </TabsContent>

                                        {/* Clinical Tab */}
                                        <TabsContent value="clinical" className="mt-0">
                                            <ClinicalTab
                                                documents={selectedPractitioner.documents}
                                                executorForm={clinicalExecutorForm}
                                                saving={saving}
                                                onExecutorChange={setClinicalExecutorForm}
                                                onSaveExecutor={handleSaveClinicalExecutor}
                                            />
                                        </TabsContent>
                                    </Tabs>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};
