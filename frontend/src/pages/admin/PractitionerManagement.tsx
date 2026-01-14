import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { AccessDenied } from '@/components/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { adminApi } from '@/services/api';
import { cn } from '@/lib/utils';

type UserStatus = 'pending' | 'active' | 'suspended' | 'rejected';

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
    membership: {
        id?: string;
        type: 'permanent' | 'ad_hoc';
        marketingAddon: boolean;
    } | null;
}

interface FullPractitioner {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
    phone?: string;
    photoUrl?: string;
    role: string;
    nextOfKin: {
        name: string;
        relationship: string;
        phone: string;
        email?: string;
    } | null;
    createdAt: string;
    membership: {
        id?: string;
        type: 'permanent' | 'ad_hoc';
        marketingAddon: boolean;
    } | null;
    documents: Array<{
        id: string;
        documentType: 'insurance' | 'clinical_registration';
        fileName: string;
        fileUrl: string;
        expiryDate: string | null;
        createdAt: string;
    }>;
    clinicalExecutor: {
        id: string;
        name: string;
        email: string;
        phone: string;
    } | null;
}

export const PractitionerManagement: React.FC = () => {
    const { user } = useAuth();
    const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
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
    const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
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

    const fetchPractitioners = useCallback(async (query?: string) => {
        try {
            setLoading(true);
            const response = await adminApi.getPractitioners(query || undefined);
            if (response.data.success && response.data.data) {
                setPractitioners(response.data.data as unknown as Practitioner[]);
            }
        } catch (error: any) {
            setMessageWithTimeout({ type: 'error', text: error.response?.data?.error || 'Failed to load practitioners' });
        } finally {
            setLoading(false);
        }
    }, [setMessageWithTimeout]);

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

    const handleSearch = () => fetchPractitioners(searchQuery);

    const handleSelectPractitioner = async (practitionerId: string) => {
        try {
            setDetailLoading(true);
            const response = await adminApi.getFullPractitioner(practitionerId);
            if (response.data.success && response.data.data) {
                setSelectedPractitioner(response.data.data as unknown as FullPractitioner);
                setActiveTab('profile');
                // Scroll to detail panel after a short delay for render
                setTimeout(() => {
                    detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        } catch (error: any) {
            setMessageWithTimeout({ type: 'error', text: error.response?.data?.error || 'Failed to load practitioner details' });
        } finally {
            setDetailLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!selectedPractitioner) return;
        try {
            setSaving(true);
            await adminApi.updatePractitioner(selectedPractitioner.id, profileForm);
            setMessageWithTimeout({ type: 'success', text: 'Profile updated successfully' });
            await handleSelectPractitioner(selectedPractitioner.id);
            await fetchPractitioners(searchQuery);
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
            if (!membershipType) {
                if (selectedPractitioner.membership) updateData.type = null;
                else { setSaving(false); return; }
            } else {
                updateData.type = membershipType;
                updateData.marketingAddon = marketingAddon;
            }
            await adminApi.updateMembership(selectedPractitioner.id, updateData);
            setMessageWithTimeout({ type: 'success', text: updateData.type === null ? 'Membership removed' : 'Membership updated' });
            await handleSelectPractitioner(selectedPractitioner.id);
            await fetchPractitioners(searchQuery);
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
            setMessageWithTimeout({ type: 'success', text: 'Next of kin updated successfully' });
            await handleSelectPractitioner(selectedPractitioner.id);
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
            setMessageWithTimeout({ type: 'success', text: 'Clinical executor updated successfully' });
            await handleSelectPractitioner(selectedPractitioner.id);
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
            setMessageWithTimeout({ type: 'success', text: 'Practitioner deleted successfully' });
            setSelectedPractitioner(null);
            await fetchPractitioners(searchQuery);
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
                            <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
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
                                        <TabsContent value="profile" className="space-y-4 pt-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="firstName">First Name</Label>
                                                    <Input id="firstName" value={profileForm.firstName} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="lastName">Last Name</Label>
                                                    <Input id="lastName" value={profileForm.lastName} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="phone">Phone</Label>
                                                <Input id="phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button onClick={handleSaveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={saving}>Delete User</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Practitioner?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete {selectedPractitioner.firstName} {selectedPractitioner.lastName} and all their data (bookings, documents, invoices). This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleDeletePractitioner} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TabsContent>

                                        {/* Membership Tab */}
                                        <TabsContent value="membership" className="space-y-4 pt-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="membershipType">Membership Type</Label>
                                                <select
                                                    id="membershipType"
                                                    value={membershipType}
                                                    onChange={(e) => {
                                                        const newType = e.target.value as 'permanent' | 'ad_hoc' | '';
                                                        setMembershipType(newType);
                                                        if (newType === 'ad_hoc') setMarketingAddon(false);
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
                                                <div className="flex items-center gap-2">
                                                    <input type="checkbox" id="marketingAddon" checked={marketingAddon} onChange={(e) => setMarketingAddon(e.target.checked)} disabled={saving} className="w-4 h-4" />
                                                    <Label htmlFor="marketingAddon">Enable Marketing Add-on</Label>
                                                </div>
                                            )}
                                            <Button onClick={handleSaveMembership} disabled={saving}>{saving ? 'Saving...' : 'Save Membership'}</Button>
                                        </TabsContent>

                                        {/* Next of Kin Tab */}
                                        <TabsContent value="nextofkin" className="space-y-4 pt-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="nokName">Name</Label>
                                                    <Input id="nokName" value={nextOfKinForm.name} onChange={(e) => setNextOfKinForm({ ...nextOfKinForm, name: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="nokRelationship">Relationship</Label>
                                                    <Input id="nokRelationship" value={nextOfKinForm.relationship} onChange={(e) => setNextOfKinForm({ ...nextOfKinForm, relationship: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="nokPhone">Phone</Label>
                                                    <Input id="nokPhone" value={nextOfKinForm.phone} onChange={(e) => setNextOfKinForm({ ...nextOfKinForm, phone: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="nokEmail">Email</Label>
                                                    <Input id="nokEmail" type="email" value={nextOfKinForm.email} onChange={(e) => setNextOfKinForm({ ...nextOfKinForm, email: e.target.value })} />
                                                </div>
                                            </div>
                                            <Button onClick={handleSaveNextOfKin} disabled={saving}>{saving ? 'Saving...' : 'Save Next of Kin'}</Button>
                                        </TabsContent>

                                        {/* Clinical Tab */}
                                        <TabsContent value="clinical" className="space-y-4 pt-4">
                                            {/* Documents Status */}
                                            <div className="space-y-2">
                                                <h4 className="font-medium text-sm">Documents</h4>
                                                <div className="space-y-2">
                                                    {selectedPractitioner.documents.length === 0 ? (
                                                        <p className="text-sm text-slate-500">No documents uploaded</p>
                                                    ) : (
                                                        selectedPractitioner.documents.map((doc) => (
                                                            <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded">
                                                                <div>
                                                                    <span className="font-medium text-sm">{doc.documentType === 'insurance' ? 'Insurance' : 'Clinical Registration'}</span>
                                                                    <p className="text-xs text-slate-500">{doc.fileName}</p>
                                                                </div>
                                                                <Badge variant={doc.expiryDate && new Date(doc.expiryDate) < new Date() ? 'destructive' : 'success'}>
                                                                    {doc.expiryDate ? (new Date(doc.expiryDate) < new Date() ? 'Expired' : `Exp: ${doc.expiryDate}`) : 'No expiry'}
                                                                </Badge>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            {/* Clinical Executor */}
                                            <div className="space-y-2 pt-4 border-t">
                                                <h4 className="font-medium text-sm">Clinical Executor</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="ceName">Name</Label>
                                                        <Input id="ceName" value={clinicalExecutorForm.name} onChange={(e) => setClinicalExecutorForm({ ...clinicalExecutorForm, name: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="ceEmail">Email</Label>
                                                        <Input id="ceEmail" type="email" value={clinicalExecutorForm.email} onChange={(e) => setClinicalExecutorForm({ ...clinicalExecutorForm, email: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="cePhone">Phone</Label>
                                                    <Input id="cePhone" value={clinicalExecutorForm.phone} onChange={(e) => setClinicalExecutorForm({ ...clinicalExecutorForm, phone: e.target.value })} />
                                                </div>
                                                <Button onClick={handleSaveClinicalExecutor} disabled={saving}>{saving ? 'Saving...' : 'Save Clinical Executor'}</Button>
                                            </div>
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
