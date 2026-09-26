import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowUpRight, BookOpen } from 'lucide-react';
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Brand Identity */}
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal p-1"
            aria-label={`${APP_CONFIG.name} Home`}
          >
            {/* Retro Academic Stamp / Emblem */}
            <div className="w-10 h-10 bg-brand-navy border-2 border-brand-dark flex items-center justify-center shadow-brutal-xs group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
              <BookOpen className="w-5 h-5 text-brand-gold stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy tracking-tight">
                  {APP_CONFIG.name}
                </span>
                <Badge variant="gold" size="sm" className="hidden sm:inline-flex">
                  MVP
                </Badge>
              </div>
              <span className="text-[10px] font-mono text-brand-muted hidden md:inline-block leading-none">
                Study &amp; Mentorship
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main Navigation">
            {NAV_LINKS.map(link => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm font-bold tracking-wide transition-colors py-1 border-b-2 ${
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
          <div className="hidden md:flex items-center gap-3">
            <Button to="/login" variant="ghost" size="sm">
              Log In
            </Button>
            <Button
              to="/signup"
              variant="primary"
              size="sm"
              rightIcon={<ArrowUpRight className="w-4 h-4 stroke-[2.5]" />}
            >
              Get Started
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/login"
              className="text-xs font-bold font-mono uppercase px-2.5 py-1.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs"
            >
              Log In
            </Link>
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="p-2 border-2 border-brand-dark bg-brand-paper text-brand-dark shadow-brutal-xs hover:bg-brand-paper-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5 stroke-[2.5]" /> : <Menu className="w-5 h-5 stroke-[2.5]" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t-2 border-brand-dark bg-brand-bg px-4 pt-4 pb-6 shadow-brutal animate-in fade-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col gap-2">
            {NAV_LINKS.map(link => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={closeMobileMenu}
                  className={`p-3 font-bold border-2 border-brand-dark text-sm ${
                    isActive
                      ? 'bg-brand-teal text-white shadow-brutal-xs'
                      : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint shadow-brutal-xs'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-3 border-t-2 border-brand-dark/20 flex flex-col gap-2 mt-2">
              <Button to="/login" variant="outline" fullWidth onClick={closeMobileMenu}>
                Log In to Portal
              </Button>
              <Button to="/signup" variant="primary" fullWidth onClick={closeMobileMenu}>
                Sign Up for PoraPlan
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
