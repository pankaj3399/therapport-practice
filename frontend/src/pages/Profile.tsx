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
import { Separator } from '@/components/ui/separator';
import api from '@/services/api';
import { cn } from '@/lib/utils';

export const Profile: React.FC = () => {
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

  // Next of Kin
  const [nextOfKin, setNextOfKin] = useState({
    name: (user?.nextOfKin as any)?.name || '',
    phone: (user?.nextOfKin as any)?.phone || '',
    email: (user?.nextOfKin as any)?.email || '',
  });

  // Update state when user changes
  useEffect(() => {
    if (user) {
      setPersonalInfo({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
      });
      setNextOfKin({
        name: (user.nextOfKin as any)?.name || '',
        phone: (user.nextOfKin as any)?.phone || '',
        email: (user.nextOfKin as any)?.email || '',
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

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || 'U';
  };

  const handlePersonalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Prepare nextOfKin object (only include if at least one field is filled)
      const nextOfKinData =
        nextOfKin.name || nextOfKin.phone || nextOfKin.email
          ? {
              name: nextOfKin.name || undefined,
              phone: nextOfKin.phone || undefined,
              email: nextOfKin.email || undefined,
            }
          : undefined;

      const response = await api.put('/auth/profile', {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        phone: personalInfo.phone || undefined,
        nextOfKin: nextOfKinData,
      });

      if (response.data.success && response.data.data) {
        // Update AuthContext with new user data
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
            Profile Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-base">
            Manage your account information and preferences
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">General Info</TabsTrigger>
            <TabsTrigger value="security">Password & Security</TabsTrigger>
            <TabsTrigger value="compliance">Clinical Requirements</TabsTrigger>
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
                  Update your personal details and contact information
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
                    <Button variant="outline" size="sm">
                      <Icon name="photo_camera" size={18} className="mr-2" />
                      Upload Photo
                    </Button>
                  </div>
                </div>

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

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Next of Kin
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="kinName">Name</Label>
                        <Input
                          id="kinName"
                          value={nextOfKin.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNextOfKin({ ...nextOfKin, name: e.target.value })
                          }
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kinPhone">Phone</Label>
                        <Input
                          id="kinPhone"
                          type="tel"
                          value={nextOfKin.phone}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNextOfKin({ ...nextOfKin, phone: e.target.value })
                          }
                          placeholder="+44 20 1234 5678"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kinEmail">Email</Label>
                      <Input
                        id="kinEmail"
                        type="email"
                        value={nextOfKin.email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setNextOfKin({ ...nextOfKin, email: e.target.value })
                        }
                        placeholder="john.doe@example.com"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Professional Indemnity Insurance
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="insuranceFile">Insurance Document</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="insuranceFile"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="flex-1"
                            disabled
                          />
                          <Button variant="outline" size="sm" disabled>
                            <Icon name="upload" size={18} className="mr-2" />
                            Upload
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Upload your professional indemnity insurance document
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="insuranceExpiry">Insurance Document Expiry Date</Label>
                        <Input
                          id="insuranceExpiry"
                          type="date"
                          disabled
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Document upload functionality will be available in Week 2
                        </p>
                      </div>
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
                  Update your email address. A verification email will be sent to your new address.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Current email:{' '}
                    <span className="font-bold text-slate-900 dark:text-white">{user?.email}</span>
                  </p>
                </div>

                <form onSubmit={handleEmailChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newEmail">New Email Address</Label>
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
                  </div>

                  <Button type="submit" disabled={loading}>
                    {loading ? 'Sending...' : 'Send Verification Email'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clinical Requirements Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="description" className="text-primary" />
                  Clinical Requirements
                </CardTitle>
                <CardDescription>Upload and manage your clinical registration documents and executor information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="clinicalRegistrationFile">Clinical Registration Document</Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 mb-2">
                        For example, a scan of your valid UKCP, BACP and HCPC registration certificate
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          id="clinicalRegistrationFile"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="flex-1"
                          disabled
                        />
                        <Button variant="outline" size="sm" disabled>
                          <Icon name="upload" size={18} className="mr-2" />
                          Upload
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Upload your professional registration document
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clinicalRegistrationExpiry">Clinical Registration Document Expiry Date</Label>
                      <Input
                        id="clinicalRegistrationExpiry"
                        type="date"
                        disabled
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                        Clinical Executor Information
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        A clinical executor is the person appointed by a therapist to carry out their professional and ethical responsibilities—such as safeguarding clients, managing clinical records, and closing or transferring a practice—if the therapist dies or becomes incapacitated.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="executorName">Name</Label>
                        <Input
                          id="executorName"
                          placeholder="John Doe"
                          disabled
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="executorEmail">Email</Label>
                        <Input
                          id="executorEmail"
                          type="email"
                          placeholder="john.doe@example.com"
                          disabled
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="executorPhone">Phone Number</Label>
                      <Input
                        id="executorPhone"
                        type="tel"
                        placeholder="+44 20 1234 5678"
                        disabled
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-500 text-center pt-4">
                    Document upload functionality will be available in Week 2
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};
