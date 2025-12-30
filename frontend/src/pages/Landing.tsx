import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import { Icon } from '@/components/ui/Icon';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Icon name="medical_services" className="text-primary text-2xl" />
          </div>
          <h2 className="text-slate-900 dark:text-white text-xl font-bold">Therapport</h2>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="outline" size="sm">
              Login
            </Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Sign Up</Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">
            Professional Practice
            <br />
            <span className="text-primary">Management Made Simple</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-8">
            Book meeting and therapy rooms, manage documents, and handle your practice operations all in one place.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link to="/signup">
              <Button size="lg">
                Get Started
                <Icon name="arrow_forward" className="ml-2" size={20} />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="bg-surface-light dark:bg-surface-dark p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
              <Icon name="calendar_month" className="text-primary text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Easy Booking
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Book rooms at our Kensington and Pimlico locations with ease. Real-time availability and instant confirmations.
            </p>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
              <Icon name="description" className="text-primary text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Document Management
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Keep track of your insurance and professional documents. Secure storage and easy access.
            </p>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
              <Icon name="dashboard" className="text-primary text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Professional Tools
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              All the tools you need to manage your practice efficiently. Track bookings, finances, and compliance.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
