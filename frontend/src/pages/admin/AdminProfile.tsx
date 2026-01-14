import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/Icon';
import { PhotoCropDialog } from '@/components/PhotoCropDialog';
import api from '@/services/api';
import { cn } from '@/lib/utils';

export const AdminProfile: React.FC = () => {
    const { user, updateUser } = useAuth();
    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Personal Information
    const [personalInfo, setPersonalInfo] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        phone: '',
    });

    // Update state when user changes
    useEffect(() => {
        if (user) {
            setPersonalInfo({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                phone: user.phone || '',
            });
        }
    }, [user]);

    // Password Change
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    // Email Change
    const [emailData, setEmailData] = useState({
        newEmail: '',
    });

    // Photo Upload
    const [photoDialogOpen, setPhotoDialogOpen] = useState(false);

    const getInitials = (firstName?: string, lastName?: string) => {
        const first = firstName?.charAt(0) || '';
        const last = lastName?.charAt(0) || '';
        return `${first}${last}`.toUpperCase() || 'A';
    };

    const handlePersonalInfoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await api.put('/auth/profile', {
                firstName: personalInfo.firstName,
                lastName: personalInfo.lastName,
                phone: personalInfo.phone || undefined,
            });

            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
                setMessage({ type: 'success', text: 'Personal information updated successfully' });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to update information',
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            setLoading(false);
            return;
        }

        if (passwordData.newPassword.length < 8) {
            setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
            setLoading(false);
            return;
        }

        try {
            const response = await api.post('/auth/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Password changed successfully' });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to change password',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await api.post('/auth/change-email', {
                newEmail: emailData.newEmail,
            });

            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: 'Verification email sent to your new address. Please check your inbox.',
                });
                setEmailData({ newEmail: '' });
                setTimeout(() => setMessage(null), 5000);
            }
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to send verification email',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">
                        Admin Profile
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base">
                        Manage your admin account settings
                    </p>
                </div>

                {message && (
                    <div
                        className={cn(
                            'p-4 rounded-lg flex items-center gap-2',
                            message.type === 'success'
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                        )}
                    >
                        <Icon name={message.type === 'success' ? 'check_circle' : 'error'} size={20} />
                        <span className="text-sm font-medium">{message.text}</span>
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="personal">General Info</TabsTrigger>
                        <TabsTrigger value="security">Password & Security</TabsTrigger>
                    </TabsList>

                    {/* Personal Information Tab */}
                    <TabsContent value="personal" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Icon name="person" className="text-primary" />
                                    General Information
                                </CardTitle>
                                <CardDescription>
                                    Update your admin account details
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-6 mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                                    <Avatar className="h-20 w-20">
                                        <AvatarImage
                                            src={user?.photoUrl}
                                            alt={`${user?.firstName} ${user?.lastName}`}
                                        />
                                        <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                                            {getInitials(user?.firstName, user?.lastName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                                            Profile Photo
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                                            Upload a photo with circular crop
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPhotoDialogOpen(true)}
                                        >
                                            <Icon name="photo_camera" size={18} className="mr-2" />
                                            {user?.photoUrl ? 'Change Photo' : 'Upload Photo'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Photo Crop Dialog */}
                                <PhotoCropDialog
                                    open={photoDialogOpen}
                                    onOpenChange={setPhotoDialogOpen}
                                    onSave={async (imageData: string) => {
                                        try {
                                            const response = await api.post('/auth/profile/photo/upload-cropped', {
                                                imageData,
                                            });
                                            if (response?.data?.success && response.data.data) {
                                                updateUser(response.data.data);
                                                setMessage({ type: 'success', text: 'Photo uploaded successfully' });
                                                setTimeout(() => setMessage(null), 3000);
                                            } else {
                                                throw new Error(response?.data?.error || 'Failed to upload photo');
                                            }
                                        } catch (err: any) {
                                            const errorMessage = err?.response?.data?.error || err?.message || 'Failed to upload photo';
                                            throw new Error(errorMessage);
                                        }
                                    }}
                                    currentPhotoUrl={user?.photoUrl}
                                />

                                <form onSubmit={handlePersonalInfoSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName">First Name</Label>
                                            <Input
                                                id="firstName"
                                                value={personalInfo.firstName}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                    setPersonalInfo({ ...personalInfo, firstName: e.target.value })
                                                }
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName">Last Name</Label>
                                            <Input
                                                id="lastName"
                                                value={personalInfo.lastName}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                    setPersonalInfo({ ...personalInfo, lastName: e.target.value })
                                                }
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            value={user?.email || ''}
                                            disabled
                                            className="bg-slate-50 dark:bg-slate-900"
                                        />
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            To change your email, use the Password & Security tab
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <div className="relative">
                                            <Icon
                                                name="phone"
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                size={20}
                                            />
                                            <Input
                                                id="phone"
                                                type="tel"
                                                value={personalInfo.phone}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                    setPersonalInfo({ ...personalInfo, phone: e.target.value })
                                                }
                                                className="pl-10"
                                                placeholder="+44 20 1234 5678"
                                            />
                                        </div>
                                    </div>

                                    <Button type="submit" disabled={loading}>
                                        {loading ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Password & Security Tab */}
                    <TabsContent value="security" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Icon name="lock" className="text-primary" />
                                    Change Password
                                </CardTitle>
                                <CardDescription>Update your password to keep your account secure</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handlePasswordChange} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="currentPassword">Current Password</Label>
                                        <div className="relative">
                                            <Icon
                                                name="lock"
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                size={20}
                                            />
                                            <Input
                                                id="currentPassword"
                                                type="password"
                                                value={passwordData.currentPassword}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                    setPasswordData({ ...passwordData, currentPassword: e.target.value })
                                                }
                                                className="pl-10"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">New Password</Label>
                                        <div className="relative">
                                            <Icon
                                                name="lock"
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                size={20}
                                            />
                                            <Input
                                                id="newPassword"
                                                type="password"
                                                value={passwordData.newPassword}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                                                }
                                                className="pl-10"
                                                required
                                                minLength={8}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Must be at least 8 characters
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                        <div className="relative">
                                            <Icon
                                                name="lock"
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                size={20}
                                            />
                                            <Input
                                                id="confirmPassword"
                                                type="password"
                                                value={passwordData.confirmPassword}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                                                }
                                                className="pl-10"
                                                required
                                                minLength={8}
                                            />
                                        </div>
                                    </div>

                                    <Button type="submit" disabled={loading}>
                                        {loading ? 'Changing...' : 'Change Password'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Icon name="mail" className="text-primary" />
                                    Change Email
                                </CardTitle>
                                <CardDescription>
                                    Update the email address associated with your account
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleEmailChange} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="currentEmail">Current Email</Label>
                                        <Input
                                            id="currentEmail"
                                            type="email"
                                            value={user?.email || ''}
                                            disabled
                                            className="bg-slate-50 dark:bg-slate-900"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="newEmail">New Email</Label>
                                        <div className="relative">
                                            <Icon
                                                name="mail"
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                size={20}
                                            />
                                            <Input
                                                id="newEmail"
                                                type="email"
                                                value={emailData.newEmail}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                    setEmailData({ newEmail: e.target.value })
                                                }
                                                className="pl-10"
                                                placeholder="new.email@example.com"
                                                required
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            A verification link will be sent to your new email address
                                        </p>
                                    </div>

                                    <Button type="submit" disabled={loading}>
                                        {loading ? 'Sending...' : 'Send Verification Email'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </MainLayout>
    );
};
