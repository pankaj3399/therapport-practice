import { MainLayout } from './layout/MainLayout';

export const AccessDenied: React.FC = () => {
  return (
    <MainLayout>
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 text-lg font-semibold mb-2">Access Denied</p>
          <p className="text-slate-600 dark:text-slate-400">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    </MainLayout>
  );
};
