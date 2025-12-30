import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/theme/ThemeToggle';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-xl font-bold text-gray-900 dark:text-white">Therapport</div>
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
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
            Welcome to Therapport
          </h1>
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Professional meeting and therapy room booking platform for practitioners. Manage your
            bookings, documents, and practice all in one place.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/signup">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="text-3xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Easy Booking
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Book rooms at our Kensington and Pimlico locations with ease
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Document Management
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Keep track of your insurance and professional documents
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-4">💼</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Professional Tools
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              All the tools you need to manage your practice efficiently
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

