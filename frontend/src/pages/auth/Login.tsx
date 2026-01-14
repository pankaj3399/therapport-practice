import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '../../components/theme/ThemeToggle';
import { Icon } from '@/components/ui/Icon';
import type { LoginRequest } from '../../types';

export const Login: React.FC = () => {
  const [formData, setFormData] = useState<LoginRequest>({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData);
      // After login, user state is updated in AuthContext
      // We need to get the user from the login response to determine redirect
      // The login function sets the user, so we check the role
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  // Effect to handle redirect after user state changes from login
  // This ensures we redirect based on the actual user role
  if (user) {
    const redirectPath = user.role === 'admin' ? '/admin' : '/dashboard';
    navigate(redirectPath, { replace: true });
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4 font-display">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Icon name="medical_services" className="text-primary text-3xl" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your Therapport account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2">
              <Icon name="error" size={20} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm font-bold text-primary hover:text-blue-600 dark:hover:text-blue-400"
              >
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Logging in...' : 'Sign In'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-primary hover:text-blue-600 dark:hover:text-blue-400">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
