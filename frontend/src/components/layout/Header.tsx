import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ThemeToggle } from '../theme/ThemeToggle';
import { useAuth } from '@/context/AuthContext';
import { practitionerNavItems, adminNavItems } from './navConfig';
import { cn } from '@/lib/utils';

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const navItems = (isAdmin ? adminNavItems : practitionerNavItems).filter(
    (item) => item.implemented === true
  );

  return (
    <>
      <header className="lg:hidden flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Therapport" className="h-6 w-auto" />
          <span className="font-bold text-lg text-slate-900 dark:text-white">Therapport</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-600 dark:text-slate-300 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <Icon name={mobileMenuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          aria-hidden="false"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div
        className={cn(
          'lg:hidden fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-surface-light dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 shadow-xl transition-transform duration-200 ease-out',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-modal="true"
        aria-label="Navigation menu"
        role="dialog"
      >
        <nav className="flex flex-col gap-1 p-4 pt-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                <Icon name={item.icon} className={cn(isActive && 'icon-fill')} />
                <span className={cn('text-sm', isActive ? 'font-bold' : 'font-medium')}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
};
