import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ThemeToggle } from '../theme/ThemeToggle';

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="lg:hidden flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 p-1.5 rounded-lg">
          <Icon name="medical_services" className="text-primary text-xl" />
        </div>
        <span className="font-bold text-lg text-slate-900 dark:text-white">Therapport</span>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-600 dark:text-slate-300 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <Icon name={mobileMenuOpen ? 'close' : 'menu'} />
        </button>
      </div>
    </header>
  );
};

