import { MainLayout } from '@/components/layout/MainLayout';

interface AccessDeniedProps {
  message?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ 
  message = 'Access denied. Admin role required.' 
}) => {
  return (
    <MainLayout>
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">{message}</p>
      </div>
    </MainLayout>
  );
};

