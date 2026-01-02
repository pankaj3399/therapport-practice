import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

export const VerifyEmailChange: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setError('Verification token is missing');
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/auth/verify-email-change?token=${token}`);
        
        if (response.data.success) {
          setSuccess(true);
          // Refresh user data to get updated email
          const userResponse = await api.get('/auth/me');
          if (userResponse.data.success && userResponse.data.data) {
            updateUser(userResponse.data.data);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to verify email change');
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [searchParams, updateUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4 font-display">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Icon name="hourglass_empty" className="text-primary text-4xl mb-4 animate-spin" />
              <p className="text-slate-600 dark:text-slate-400">Verifying email change...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4 font-display">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className={cn(
              'p-3 rounded-xl',
              success ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
            )}>
              <Icon 
                name={success ? 'check_circle' : 'error'} 
                className={cn(
                  'text-3xl',
                  success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )} 
              />
            </div>
          </div>
          <CardTitle className="text-2xl font-black text-center">
            {success ? 'Email Changed Successfully' : 'Verification Failed'}
          </CardTitle>
          <CardDescription className="text-center">
            {success 
              ? 'Your email address has been updated successfully.'
              : error || 'Unable to verify email change. The link may have expired or is invalid.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            className="w-full" 
            onClick={() => navigate('/profile')}
          >
            {success ? 'Go to Profile' : 'Try Again'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

