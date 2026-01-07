import { useState, useEffect, useRef } from 'react';
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
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';
import { cn } from '@/lib/utils';
import { useDocumentUpload, DocumentData } from '@/hooks/useDocumentUpload';

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

  // Fetch insurance document on mount
  useEffect(() => {
    const fetchInsuranceDocument = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: {
            id: string;
            fileName: string;
            expiryDate: string;
            documentUrl: string;
            isExpired: boolean;
            isExpiringSoon: boolean;
            daysUntilExpiry: number | null;
          };
        }>('/practitioner/documents/insurance');
        if (response.data.success && response.data.data) {
          setInsuranceDocument(response.data.data);
        }
      } catch (error: any) {
        // 404 is expected if no document exists yet
        if (error.response?.status !== 404) {
          console.error('Failed to fetch insurance document:', error);
        }
      }
    };

    if (user) {
      fetchInsuranceDocument();
    }
  }, [user]);

  // Fetch clinical document and executor on mount (if marketing add-on)
  useEffect(() => {
    const fetchClinicalData = async () => {
      if (!user?.membership?.marketingAddon) {
        return;
      }

      // Fetch clinical document
      try {
        const docResponse = await api.get<{
          success: boolean;
          data: {
            id: string;
            fileName: string;
            expiryDate: string;
            documentUrl: string;
            isExpired: boolean;
            isExpiringSoon: boolean;
            daysUntilExpiry: number | null;
          };
        }>('/practitioner/documents/clinical');
        if (docResponse.data.success && docResponse.data.data) {
          setClinicalDocument(docResponse.data.data);
        }
      } catch (error: any) {
        // 404 is expected if no document exists yet
        if (error.response?.status !== 404) {
          console.error('Failed to fetch clinical document:', error);
        }
      }

      // Fetch clinical executor
      try {
        const executorResponse = await api.get<{
          success: boolean;
          data: {
            id: string;
            name: string;
            email: string;
            phone: string;
          };
        }>('/practitioner/clinical-executor');
        if (executorResponse.data.success && executorResponse.data.data) {
          setExecutorData({
            name: executorResponse.data.data.name,
            email: executorResponse.data.data.email,
            phone: executorResponse.data.data.phone,
          });
        }
      } catch (error: any) {
        // 404 is expected if no executor exists yet
        if (error.response?.status !== 404) {
          console.error('Failed to fetch clinical executor:', error);
        }
      }
    };

    if (user) {
      fetchClinicalData();
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
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Insurance Document Upload
  const [insuranceDocument, setInsuranceDocument] = useState<DocumentData | null>(null);
  const insuranceFileInputRef = useRef<HTMLInputElement>(null);
  const insuranceUpload = useDocumentUpload({
    baseEndpoint: '/practitioner/documents/insurance',
    onSuccess: setInsuranceDocument,
    setMessage,
    successMessage: 'Insurance document uploaded successfully',
  });

  // Clinical Document Upload (Marketing Add-on Only)
  const [clinicalDocument, setClinicalDocument] = useState<DocumentData | null>(null);
  const clinicalFileInputRef = useRef<HTMLInputElement>(null);
  const clinicalUpload = useDocumentUpload({
    baseEndpoint: '/practitioner/documents/clinical',
    onSuccess: setClinicalDocument,
    setMessage,
    successMessage: 'Clinical document uploaded successfully',
  });

  // Clinical Executor
  const [executorData, setExecutorData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [executorLoading, setExecutorLoading] = useState(false);

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || 'U';
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 5MB' });
      return;
    }

    // Create preview and save file for confirmation
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
      setSelectedPhoto(file);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoCancel = () => {
    setPhotoPreview(null);
    setSelectedPhoto(null);
    setMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePhotoUpload = async (file: File | null) => {
    // Guard against concurrent uploads
    if (photoUploading) {
      return;
    }

    // Validate file is selected
    if (!file) {
      setMessage({ type: 'error', text: 'No file selected' });
      return;
    }

    // Set uploading state synchronously before any awaits
    setPhotoUploading(true);
    setMessage(null);

    try {
      // Step 1: Get presigned URL from backend
      const uploadUrlResponse = await api.post('/auth/profile/photo/upload-url', {
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      if (!uploadUrlResponse.data.success) {
        throw new Error(uploadUrlResponse.data.error || 'Failed to get upload URL');
      }

      const { presignedUrl, filePath, oldPhotoPath } = uploadUrlResponse.data.data;

      // Step 2: Upload file directly to R2
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Step 3: Confirm upload with backend
      const confirmResponse = await api.put('/auth/profile/photo/confirm', {
        filePath,
        oldPhotoPath: oldPhotoPath || undefined,
      });

      if (confirmResponse.data.success && confirmResponse.data.data) {
        // Update user in context
        updateUser(confirmResponse.data.data);
        setMessage({ type: 'success', text: 'Photo uploaded successfully' });
        setPhotoPreview(null);
        setSelectedPhoto(null);
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || error.message || 'Failed to upload photo',
      });
      // Don't clear preview on error - let user retry or cancel
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleInsuranceCancel = () => {
    insuranceUpload.handleCancel();
    if (insuranceFileInputRef.current) {
      insuranceFileInputRef.current.value = '';
    }
  };

  const handleClinicalCancel = () => {
    clinicalUpload.handleCancel();
    if (clinicalFileInputRef.current) {
      clinicalFileInputRef.current.value = '';
    }
  };

  // Clear file input refs when files are cleared after successful upload
  useEffect(() => {
    if (!insuranceUpload.selectedFile && insuranceFileInputRef.current) {
      insuranceFileInputRef.current.value = '';
    }
  }, [insuranceUpload.selectedFile]);

  useEffect(() => {
    if (!clinicalUpload.selectedFile && clinicalFileInputRef.current) {
      clinicalFileInputRef.current.value = '';
    }
  }, [clinicalUpload.selectedFile]);

  const handleExecutorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExecutorLoading(true);
    setMessage(null);

    try {
      const response = await api.post('/practitioner/clinical-executor', executorData);
      if (response.data.success && response.data.data) {
        setMessage({ type: 'success', text: 'Clinical executor information saved successfully' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to save executor information',
      });
    } finally {
      setExecutorLoading(false);
    }
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
          <TabsList className={user?.membership?.marketingAddon ? "grid w-full grid-cols-3" : "grid w-full grid-cols-2"}>
            <TabsTrigger value="personal">General Info</TabsTrigger>
            <TabsTrigger value="security">Password & Security</TabsTrigger>
            {user?.membership?.marketingAddon && (
              <TabsTrigger value="compliance">Clinical Requirements</TabsTrigger>
            )}
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
                      src={photoPreview || user?.photoUrl}
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      id="photo-upload"
                      disabled={photoUploading}
                    />
                    {photoPreview ? (
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handlePhotoUpload(selectedPhoto)}
                          disabled={photoUploading || !selectedPhoto}
                        >
                          <Icon name="check" size={18} className="mr-2" />
                          {photoUploading ? 'Uploading...' : 'Confirm Upload'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePhotoCancel}
                          disabled={photoUploading}
                        >
                          <Icon name="close" size={18} className="mr-2" />
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={photoUploading}
                      >
                        <Icon name="photo_camera" size={18} className="mr-2" />
                        Upload Photo
                      </Button>
                    )}
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
                    
                    {/* Current Insurance Document Status */}
                    {insuranceDocument && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon 
                              name={insuranceDocument.isExpired ? 'error' : insuranceDocument.isExpiringSoon ? 'warning' : 'verified'} 
                              className={cn(
                                insuranceDocument.isExpired 
                                  ? 'text-red-500' 
                                  : insuranceDocument.isExpiringSoon 
                                  ? 'text-orange-500' 
                                  : 'text-green-500'
                              )} 
                            />
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {insuranceDocument.fileName}
                            </span>
                          </div>
                          <Badge 
                            variant={insuranceDocument.isExpired ? 'destructive' : insuranceDocument.isExpiringSoon ? 'warning' : 'success'}
                          >
                            {insuranceDocument.isExpired 
                              ? 'Expired' 
                              : insuranceDocument.isExpiringSoon 
                              ? `Expires in ${insuranceDocument.daysUntilExpiry} days`
                              : `Valid until ${new Date(insuranceDocument.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                          </Badge>
                        </div>
                        {insuranceDocument.isExpired && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                            Your insurance document has expired. Please upload a new one.
                          </p>
                        )}
                        {insuranceDocument.isExpiringSoon && !insuranceDocument.isExpired && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                            Your insurance document is expiring soon. Please upload a new one.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Insurance Upload Form */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="insuranceFile">Insurance Document</Label>
                        <input
                          ref={insuranceFileInputRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={insuranceUpload.handleFileSelect}
                          className="hidden"
                          id="insuranceFile"
                          disabled={insuranceUpload.uploading}
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={insuranceUpload.selectedFile?.name || ''}
                            placeholder="No file selected"
                            readOnly
                            className="flex-1 cursor-pointer"
                            onClick={() => insuranceFileInputRef.current?.click()}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => insuranceFileInputRef.current?.click()}
                            disabled={insuranceUpload.uploading}
                          >
                            <Icon name="upload" size={18} className="mr-2" />
                            Select File
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Upload your professional indemnity insurance document (PDF, JPG, PNG, max 10MB)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="insuranceExpiry">Insurance Document Expiry Date</Label>
                        <Input
                          id="insuranceExpiry"
                          type="date"
                          value={insuranceUpload.expiryDate}
                          onChange={(e) => insuranceUpload.setExpiryDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          disabled={insuranceUpload.uploading || !insuranceUpload.selectedFile}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Select the expiry date of your insurance document
                        </p>
                      </div>
                      {insuranceUpload.selectedFile && (
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={insuranceUpload.handleUpload}
                            disabled={insuranceUpload.uploading || !insuranceUpload.expiryDate}
                          >
                            <Icon name="check" size={18} className="mr-2" />
                            {insuranceUpload.uploading ? 'Uploading...' : 'Upload Document'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleInsuranceCancel}
                            disabled={insuranceUpload.uploading}
                          >
                            <Icon name="close" size={18} className="mr-2" />
                            Cancel
                          </Button>
                        </div>
                      )}
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

          {/* Clinical Requirements Tab - Only visible with marketing add-on */}
          {user?.membership?.marketingAddon && (
            <TabsContent value="compliance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon name="description" className="text-primary" />
                    Clinical Requirements
                  </CardTitle>
                  <CardDescription>
                    Upload and manage your clinical registration documents and executor information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Clinical Registration Document Upload */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Clinical Registration Document
                      </h3>
                      
                      {/* Current Document Status */}
                      {clinicalDocument && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Icon 
                                name={clinicalDocument.isExpired ? 'error' : clinicalDocument.isExpiringSoon ? 'warning' : 'verified'} 
                                className={cn(
                                  clinicalDocument.isExpired 
                                    ? 'text-red-500' 
                                    : clinicalDocument.isExpiringSoon 
                                    ? 'text-orange-500' 
                                    : 'text-green-500'
                                )} 
                              />
                              <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {clinicalDocument.fileName}
                              </span>
                            </div>
                            <Badge 
                              variant={clinicalDocument.isExpired ? 'destructive' : clinicalDocument.isExpiringSoon ? 'warning' : 'success'}
                            >
                              {clinicalDocument.isExpired 
                                ? 'Expired' 
                                : clinicalDocument.isExpiringSoon 
                                ? `Expires in ${clinicalDocument.daysUntilExpiry} days`
                                : `Valid until ${new Date(clinicalDocument.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                            </Badge>
                          </div>
                          {clinicalDocument.isExpired && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                              Your clinical registration document has expired. Please upload a new one.
                            </p>
                          )}
                          {clinicalDocument.isExpiringSoon && !clinicalDocument.isExpired && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                              Your clinical registration document is expiring soon. Please upload a new one.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Upload Form */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="clinicalRegistrationFile">Clinical Registration Document</Label>
                          <input
                            ref={clinicalFileInputRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={clinicalUpload.handleFileSelect}
                            className="hidden"
                            id="clinicalRegistrationFile"
                            disabled={clinicalUpload.uploading}
                          />
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              value={clinicalUpload.selectedFile?.name || ''}
                              placeholder="No file selected"
                              readOnly
                              className="flex-1 cursor-pointer"
                              onClick={() => clinicalFileInputRef.current?.click()}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => clinicalFileInputRef.current?.click()}
                              disabled={clinicalUpload.uploading}
                            >
                              <Icon name="upload" size={18} className="mr-2" />
                              Select File
                            </Button>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Upload your clinical registration document (PDF, JPG, PNG, max 10MB)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="clinicalRegistrationExpiry">Document Expiry Date</Label>
                          <Input
                            id="clinicalRegistrationExpiry"
                            type="date"
                            value={clinicalUpload.expiryDate}
                            onChange={(e) => clinicalUpload.setExpiryDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            disabled={clinicalUpload.uploading || !clinicalUpload.selectedFile}
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Select the expiry date of your clinical registration document
                          </p>
                        </div>
                        {clinicalUpload.selectedFile && (
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={clinicalUpload.handleUpload}
                              disabled={clinicalUpload.uploading || !clinicalUpload.expiryDate}
                            >
                              <Icon name="check" size={18} className="mr-2" />
                              {clinicalUpload.uploading ? 'Uploading...' : 'Upload Document'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleClinicalCancel}
                              disabled={clinicalUpload.uploading}
                            >
                              <Icon name="close" size={18} className="mr-2" />
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Clinical Executor Form */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                          Clinical Executor Information
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                          A clinical executor is the person appointed by a therapist to carry out
                          their professional and ethical responsibilities—such as safeguarding
                          clients, managing clinical records, and closing or transferring a
                          practice—if the therapist dies or becomes incapacitated.
                        </p>
                      </div>
                      <form onSubmit={handleExecutorSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="executorName">Name</Label>
                            <Input
                              id="executorName"
                              placeholder="John Doe"
                              value={executorData.name}
                              onChange={(e) => setExecutorData({ ...executorData, name: e.target.value })}
                              required
                              disabled={executorLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="executorEmail">Email</Label>
                            <Input
                              id="executorEmail"
                              type="email"
                              placeholder="john.doe@example.com"
                              value={executorData.email}
                              onChange={(e) => setExecutorData({ ...executorData, email: e.target.value })}
                              required
                              disabled={executorLoading}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="executorPhone">Phone Number</Label>
                          <Input
                            id="executorPhone"
                            type="tel"
                            placeholder="+44 20 1234 5678"
                            value={executorData.phone}
                            onChange={(e) => setExecutorData({ ...executorData, phone: e.target.value })}
                            required
                            disabled={executorLoading}
                          />
                        </div>
                        <Button type="submit" disabled={executorLoading}>
                          {executorLoading ? 'Saving...' : 'Save Executor Information'}
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
};
