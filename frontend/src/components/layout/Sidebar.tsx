import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Icon } from '@/components/ui/Icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  icon: string;
  path: string;
  active?: boolean;
  implemented?: boolean;
}

// Navigation items for practitioners (renters)
const practitionerNavItems: NavItem[] = [
  { name: 'Dashboard', icon: 'dashboard', path: '/dashboard', implemented: true },
  { name: 'Bookings', icon: 'calendar_month', path: '/bookings', implemented: false },
  { name: 'Finance', icon: 'credit_card', path: '/finance', implemented: false },
  { name: 'Compliance', icon: 'description', path: '/compliance', implemented: false },
  { name: 'Support', icon: 'support_agent', path: '/support', implemented: false },
  { name: 'Profile', icon: 'person', path: '/profile', implemented: true },
];

// Navigation items for admins (not renters)
const adminNavItems: NavItem[] = [
  { name: 'Dashboard', icon: 'dashboard', path: '/admin', implemented: true },
  { name: 'Practitioners', icon: 'people', path: '/admin/practitioners', implemented: true },
  { name: 'Profile', icon: 'person', path: '/admin/profile', implemented: true },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || 'U';
  };

  // Determine which nav items to show based on user role
  const isAdmin = user?.role === 'admin';
  const navItems = isAdmin ? adminNavItems : practitionerNavItems;
  const appTitle = isAdmin ? 'Admin Panel' : "Renter's App";

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-surface-light dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 h-full p-6 justify-between shrink-0">
      <div className="flex flex-col gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2">
          <img src="/logo.png" alt="Therapport" className="h-8 w-auto" />
          <div className="flex flex-col">
            <h1 className="text-slate-900 dark:text-white text-lg font-bold leading-none">Therapport</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">{appTitle}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2">
          {navItems
            .filter((item) => item.implemented === true)
            .map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  <Icon
                    name={item.icon}
                    className={cn(
                      isActive && 'icon-fill',
                      !isActive && 'group-hover:text-primary transition-colors'
                    )}
                  />
                  <span className={cn('text-sm', isActive ? 'font-bold' : 'font-medium')}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
        </nav>
      </div>

      {/* User Mini Profile */}
      <div className="flex items-center gap-3 px-2 py-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
        <Avatar className="h-10 w-10">
          <AvatarImage src="" alt={`${user?.firstName} ${user?.lastName}`} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {getInitials(user?.firstName, user?.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col overflow-hidden flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {isAdmin ? 'Administrator' : 'Renter'}
          </p>
        </div>
        <button
          onClick={logout}
          className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label="Logout"
        >
          <Icon name="logout" className="text-xl" />
        </button>
      </div>
    </aside>
  );
};
