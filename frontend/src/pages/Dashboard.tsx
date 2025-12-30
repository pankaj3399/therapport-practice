import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ThemeToggle } from '../components/theme/ThemeToggle';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-xl font-bold text-gray-900 dark:text-white">Therapport</div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Welcome, {user?.firstName} {user?.lastName}!
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            This is a placeholder dashboard. More features will be added in subsequent weeks.
          </p>
        </Card>
      </main>
    </div>
  );
};

