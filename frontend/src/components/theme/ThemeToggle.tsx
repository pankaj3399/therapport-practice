import { useTheme } from '../../context/ThemeContext';
import { Icon } from '@/components/ui/Icon';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
      aria-label="Toggle theme"
    >
      <Icon name={theme === 'light' ? 'dark_mode' : 'light_mode'} size={20} />
    </button>
  );
};
