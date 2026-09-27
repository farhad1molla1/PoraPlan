import React from 'react';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="w-full min-h-[calc(100vh-140px)] flex items-center justify-center py-16 px-4 academic-grid-pattern">
      <div className="max-w-md w-full text-center">
        <Card
          variant="paper"
          shadow="lg"
          headerBar={<span>PAGE NOT FOUND // 404</span>}
        >
          <div className="w-14 h-14 bg-brand-gold border-2 border-brand-dark flex items-center justify-center mx-auto mb-4 shadow-brutal-xs">
            <FileQuestion className="w-7 h-7 text-brand-dark stroke-[2.5]" />
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy">
            Page Not Found
          </h1>

          <p className="text-xs sm:text-sm text-brand-dark/80 font-sans mt-2 mb-5">
            The page you requested doesn't exist or may have been moved.
          </p>

          <Button
            to="/"
            variant="primary"
            fullWidth
            leftIcon={<ArrowLeft className="w-4 h-4 stroke-[2.5]" />}
          >
            Return to Home
          </Button>
        </Card>
      </div>
    </div>
  );
};
