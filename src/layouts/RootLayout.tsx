import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { RouteErrorBoundary } from '../components/common/ErrorBoundary';
import { LoadingFallback } from '../components/common/LoadingFallback';

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-brand-dark">
      <Navbar />
      <main className="flex-1 w-full" id="main-content">
        <RouteErrorBoundary>
          <Suspense fallback={<LoadingFallback label="LOADING PAGE" subtext="Loading page resources..." />}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <Footer />
    </div>
  );
};
