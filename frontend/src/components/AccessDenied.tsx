import { MainLayout } from '@/components/layout/MainLayout';
import { Icon } from '@/components/ui/Icon';

interface AccessDeniedProps {
  message?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ 
  message = 'Access denied. Admin role required.' 
}) => {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <h2 className="text-2xl font-semibold text-red-500" role="alert">
          Access Denied
        </h2>
        <div className="flex items-center gap-2">
          <Icon 
            name="block" 
            className="text-red-500" 
            size={24}
            aria-hidden="true"
          />
          <p className="text-red-500" aria-live="polite">{message}</p>
        </div>
      </div>
    </MainLayout>
  );
};

