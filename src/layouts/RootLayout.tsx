import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { RouteErrorBoundary } from '../components/common/ErrorBoundary';

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-brand-dark">
      <Navbar />
      <main className="flex-1 w-full" id="main-content">
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>
      <Footer />
    </div>
  );
};
