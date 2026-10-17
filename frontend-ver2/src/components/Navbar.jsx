import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Magnetic from './Magnetic';
import Icon from './Icons';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile sheet on route change.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navLink = (to, label, id) => {
    const active = location.pathname === to;
    return (
      <Link
        id={id}
        to={to}
        className={`cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] transition-colors duration-200 ${
          active ? 'text-fg' : 'text-fg-muted hover:text-fg'
        }`}
        aria-current={active ? 'page' : undefined}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] px-6 md:px-12 lg:px-16 flex items-center justify-between transition-all duration-300 ease-out ${
        scrolled
          ? 'py-4 bg-background/80 backdrop-blur-2xl border-b border-border shadow-[0_4px_40px_rgba(0,0,0,0.5)]'
          : 'py-6 bg-transparent border-b border-transparent'
      }`}
    >
      {/* Logo */}
      <Magnetic strength={0.2}>
        <Link
          to="/"
          className="cursor-pointer flex items-center gap-2.5 text-lg font-display font-black tracking-tight text-fg select-none"
        >
          <Icon.Tent size={22} className="text-secondary" />
          <span>YelpCamp</span>
        </Link>
      </Magnetic>

      {/* Desktop navigation */}
      <div className="hidden md:flex items-center gap-7">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-ai-dock', { detail: { mode: 'search' } }))}
          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-400/30 hover:border-sky-400/60 text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-200"
          aria-label="Open AI Vector Search"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
          <span>AI Search</span>
        </button>
        {navLink('/campgrounds', 'Explore', 'nav-explore')}
        {user && navLink('/dashboard', 'Dashboard', 'nav-dashboard')}

        {user ? (
          <div className="flex items-center gap-5">
            <Link to="/dashboard" className="cursor-pointer flex items-center gap-2.5 group">
              <span className="w-8 h-8 rounded-full border border-border-strong p-px overflow-hidden group-hover:border-secondary transition-colors">
                <img
                  src={user.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`}
                  alt={`${user.username} avatar`}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
                  }}
                />
              </span>
              <span className="text-xs font-semibold tracking-wide text-fg-muted group-hover:text-fg transition-colors">
                {user.username}
              </span>
            </Link>
            <Magnetic strength={0.4}>
              <button
                onClick={handleLogout}
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold tracking-wide text-fg-muted hover:text-fg border border-border hover:border-border-strong rounded-full transition-colors duration-200"
              >
                <Icon.LogOut size={15} />
                Log out
              </button>
            </Magnetic>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            {navLink('/login', 'Sign in')}
            <Magnetic strength={0.3}>
              <Link
                to="/register"
                className="cursor-pointer inline-flex items-center justify-center px-6 py-3 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-[0.14em] transition-transform duration-200 hover:scale-[1.04] active:scale-95"
              >
                Join
              </Link>
            </Magnetic>
          </div>
        )}
      </div>

      {/* Mobile trigger */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="cursor-pointer md:hidden inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-border text-fg active:scale-95 transition-transform"
        aria-expanded={menuOpen}
        aria-controls="mobile-nav"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      >
        {menuOpen ? <Icon.Close size={20} /> : <Icon.Menu size={20} />}
      </button>

      {/* Mobile backdrop overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[-1] md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sheet */}
      {menuOpen && (
        <div
          id="mobile-nav"
          className="md:hidden absolute top-full left-0 right-0 mx-4 mt-2 rounded-2xl bg-surface/95 backdrop-blur-2xl border border-border/80 shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-4 flex flex-col gap-1.5"
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              window.dispatchEvent(new CustomEvent('open-ai-dock', { detail: { mode: 'search' } }));
            }}
            className="cursor-pointer min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold text-sky-400 bg-sky-500/10 border border-sky-400/20 hover:bg-sky-500/20 flex items-center justify-between transition-colors text-left"
          >
            <span className="flex items-center gap-3">
              <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3 1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
              </svg>
              AI Vector Search & Guide
            </span>
            <Icon.ArrowRight size={15} className="text-sky-400" />
          </button>
          <Link
            to="/campgrounds"
            className="cursor-pointer min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold text-fg hover:bg-white/5 active:bg-white/10 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-3">
              <Icon.Compass size={18} className="text-secondary" />
              Explore Campsites
            </span>
            <Icon.ArrowRight size={15} className="text-fg-subtle" />
          </Link>
          {user && (
            <Link
              to="/dashboard"
              className="cursor-pointer min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold text-fg hover:bg-white/5 active:bg-white/10 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-3">
                <Icon.Users size={18} className="text-secondary" />
                Dashboard
              </span>
              <Icon.ArrowRight size={15} className="text-fg-subtle" />
            </Link>
          )}
          <div className="h-px bg-border/60 my-1" />
          {user ? (
            <button
              onClick={handleLogout}
              className="cursor-pointer min-h-[48px] text-left rounded-xl px-4 py-3 text-sm font-semibold text-fg-muted hover:bg-white/5 active:bg-white/10 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-3">
                <Icon.LogOut size={18} className="text-destructive" />
                Log out ({user.username})
              </span>
            </button>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <Link
                to="/login"
                className="cursor-pointer min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold text-fg border border-border/80 hover:bg-white/5 active:bg-white/10 text-center transition-colors flex items-center justify-center"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="cursor-pointer min-h-[48px] rounded-xl px-4 py-3 text-sm font-bold text-on-primary bg-primary text-center shadow-[0_0_25px_rgba(14,165,233,0.35)] flex items-center justify-center transition-transform active:scale-[0.98]"
              >
                Join YelpCamp
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
