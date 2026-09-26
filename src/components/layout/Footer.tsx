import React from 'react';
import { Link } from 'react-router-dom';
import { APP_CONFIG, NAV_LINKS } from '../../lib/constants';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto bg-brand-navy text-brand-bg border-t-2 border-brand-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 p-0.5 bg-brand-paper border-2 border-brand-dark flex items-center justify-center shadow-brutal-xs shrink-0">
                <img
                  src="/poraplan-logo.png"
                  alt="PoraPlan Logo"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('assets')) {
                      target.src = '/assets/poraplan-logo.png';
                    }
                  }}
                />
              </div>
              <span className="font-heading font-extrabold text-lg sm:text-xl text-brand-bg tracking-tight">
                {APP_CONFIG.name}
              </span>
              <span className="font-mono text-[10px] sm:text-xs px-2 py-0.5 border border-brand-bg/30 text-brand-gold">
                {APP_CONFIG.version}
              </span>
            </div>
            
            <p className="text-brand-bg/80 text-xs sm:text-sm max-w-md font-sans">
              {APP_CONFIG.tagline}
            </p>

            <div className="inline-block p-2.5 border-2 border-brand-bg/20 bg-black/20 text-[11px] sm:text-xs font-mono text-brand-bg/70">
              <span className="text-brand-gold font-bold">STATUS:</span> Phase 0 Foundation // Personal Study Assistance &amp; Mentorship
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-brand-gold font-bold">
              Navigation
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-brand-bg/80 hover:text-white hover:underline">
                  Home (Landing)
                </Link>
              </li>
              {NAV_LINKS.map(link => (
                <li key={link.href}>
                  <Link to={link.href} className="text-brand-bg/80 hover:text-white hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Portal Access */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-brand-gold font-bold">
              Portal Access
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/login" className="text-brand-bg/80 hover:text-white hover:underline">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/signup" className="text-brand-bg/80 hover:text-white hover:underline">
                  Student &amp; Mentor Sign Up
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-brand-bg/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-brand-bg/60">
          <p>© {new Date().getFullYear()} {APP_CONFIG.name}. {APP_CONFIG.descriptor}.</p>
          <p className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-brand-teal"></span>
            Mobile-First PWA Platform Ready
          </p>
        </div>
      </div>
    </footer>
  );
};
