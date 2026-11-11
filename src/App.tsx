import React, { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { AppRoutes } from './routes';
import { RootErrorBoundary } from './components/common/ErrorBoundary';
import { LoadingFallback } from './components/common/LoadingFallback';

export const App: React.FC = () => {
  return (
    <RootErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Suspense
              fallback={
                <LoadingFallback
                  label="PORAPLAN WORKSPACE"
                  subtext="Initializing system..."
                  minHeight="min-h-screen"
                />
              }
            >
              <AppRoutes />
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </RootErrorBoundary>
  );
};

export default App;
