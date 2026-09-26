import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { NAV_LINKS, APP_CONFIG } from '../../lib/constants';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMobileMenu = () => setMobileMenuOpen(prev => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 bg-brand-bg border-b-2 border-brand-dark">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Official Logo & Brand Identity */}
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal py-1"
            aria-label={`${APP_CONFIG.name} Home`}
          >
            {/* Official Logo Mark */}
            <div className="h-8 w-8 sm:h-9 sm:w-9 p-0.5 bg-brand-paper border-2 border-brand-dark flex items-center justify-center shadow-brutal-xs group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0">
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
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy tracking-tight leading-tight">
                  {APP_CONFIG.name}
                </span>
                <Badge variant="gold" size="sm" className="hidden sm:inline-flex py-0 px-1 text-[9px]">
                  MVP
                </Badge>
              </div>
              <span className="text-[10px] font-mono text-brand-muted hidden sm:inline-block leading-none">
                Study &amp; Mentorship
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Main Navigation">
            {NAV_LINKS.map(link => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-xs sm:text-sm font-bold tracking-tight transition-colors py-1 border-b-2 ${
                    isActive
                      ? 'border-brand-dark text-brand-navy'
                      : 'border-transparent text-brand-dark/80 hover:text-brand-navy hover:border-brand-teal'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Auth CTAs */}
          <div className="hidden md:flex items-center gap-2.5">
            <Button to="/login" variant="ghost" size="sm">
              Log In
            </Button>
            <Button
              to="/signup"
              variant="primary"
              size="sm"
              rightIcon={<ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />}
            >
              Get Started
            </Button>
          </div>

          {/* Mobile Menu & Direct Actions */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/login"
              className="text-[11px] font-mono font-bold px-2 py-1 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs hover:bg-brand-paper-tint"
            >
              Log In
            </Link>
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="p-1.5 border-2 border-brand-dark bg-brand-paper text-brand-dark shadow-brutal-xs hover:bg-brand-paper-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-4 h-4 stroke-[2.5]" /> : <Menu className="w-4 h-4 stroke-[2.5]" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t-2 border-brand-dark bg-brand-bg px-4 pt-3 pb-5 shadow-brutal animate-in fade-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col gap-2">
            {NAV_LINKS.map(link => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={closeMobileMenu}
                  className={`p-2.5 font-bold border-2 border-brand-dark text-xs sm:text-sm ${
                    isActive
                      ? 'bg-brand-teal text-white shadow-brutal-xs'
                      : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint shadow-brutal-xs'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-2.5 border-t-2 border-brand-dark/20 flex flex-col gap-2 mt-1">
              <Button to="/login" variant="outline" size="sm" fullWidth onClick={closeMobileMenu}>
                Log In to Portal
              </Button>
              <Button to="/signup" variant="primary" size="sm" fullWidth onClick={closeMobileMenu}>
                Sign Up for PoraPlan
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
