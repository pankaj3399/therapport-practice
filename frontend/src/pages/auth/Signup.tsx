import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '../../components/theme/ThemeToggle';
import { Icon } from '@/components/ui/Icon';


export const Signup: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [membershipType, setMembershipType] = useState<'permanent' | 'ad_hoc'>('permanent');
  const [marketingAddon, setMarketingAddon] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Update formData when membership selection changes
  const updateMembership = (type: 'permanent' | 'ad_hoc', marketing: boolean) => {
    setMembershipType(type);
    setMarketingAddon(marketing);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register({
        ...formData,
        membershipType,
        marketingAddon,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4 font-display py-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Icon name="medical_services" className="text-primary text-3xl" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black text-center">Create account</CardTitle>
          <CardDescription className="text-center">
            Sign up to start managing your practice
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2">
              <Icon name="error" size={20} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, firstName: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <div className="relative">
                  <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastName: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
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
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Select Membership Plan</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Option 1: Permanent Member */}
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      updateMembership('permanent', false);
                    }
                  }}
                  className={`border rounded-xl p-4 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary ${membershipType === 'permanent' && !marketingAddon
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                    }`}
                  onClick={() => updateMembership('permanent', false)}
                >
                  <div className="font-bold text-lg mb-1">Permanent</div>
                  <p className="text-xs text-muted-foreground">Rent a regular slot each week.</p>
                </div>

                {/* Option 2: Permanent + Marketing */}
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      updateMembership('permanent', true);
                    }
                  }}
                  className={`border rounded-xl p-4 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary ${membershipType === 'permanent' && marketingAddon
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                    }`}
                  onClick={() => updateMembership('permanent', true)}
                >
                  <div className="font-bold text-lg mb-1">Permanent + Marketing</div>
                  <p className="text-xs text-muted-foreground">Rent a regular slot + advertising on website.</p>
                </div>

                {/* Option 3: Ad Hoc Member */}
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      updateMembership('ad_hoc', false);
                    }
                  }}
                  className={`border rounded-xl p-4 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary ${membershipType === 'ad_hoc'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                    }`}
                  onClick={() => updateMembership('ad_hoc', false)}
                >
                  <div className="font-bold text-lg mb-1">Ad Hoc</div>
                  <p className="text-xs text-muted-foreground">Book individual hours when available.</p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-primary hover:text-blue-600 dark:hover:text-blue-400">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
