import { MainLayout } from './layout/MainLayout';

export const AccessDenied: React.FC = () => {
  return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-red-500 text-lg font-semibold mb-2">Access Denied</h1>
          <p className="text-slate-600 dark:text-slate-400">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    </MainLayout>
  );
};
