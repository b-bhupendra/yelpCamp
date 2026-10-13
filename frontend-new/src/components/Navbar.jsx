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

  const navLink = (to, label) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={`cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] transition-colors duration-200 ${
          active ? 'text-fg' : 'text-fg-subtle hover:text-fg'
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
      <div className="hidden md:flex items-center gap-9">
        {navLink('/index', 'Explore')}
        {user && navLink('/dashboard', 'Dashboard')}

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
        className="cursor-pointer md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full border border-border text-fg"
        aria-expanded={menuOpen}
        aria-controls="mobile-nav"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      >
        {menuOpen ? <Icon.Close size={20} /> : <Icon.Menu size={20} />}
      </button>

      {/* Mobile sheet */}
      {menuOpen && (
        <div
          id="mobile-nav"
          className="md:hidden absolute top-full left-0 right-0 mx-4 mt-2 rounded-2xl glass-obsidian-strong border border-border p-4 flex flex-col gap-1"
        >
          <Link to="/index" className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-fg hover:bg-white/5 transition-colors">Explore</Link>
          {user && (
            <Link to="/dashboard" className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-fg hover:bg-white/5 transition-colors">Dashboard</Link>
          )}
          {user ? (
            <button
              onClick={handleLogout}
              className="cursor-pointer text-left rounded-xl px-4 py-3 text-sm font-semibold text-fg-muted hover:bg-white/5 transition-colors"
            >
              Log out
            </button>
          ) : (
            <>
              <Link to="/login" className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-fg hover:bg-white/5 transition-colors">Sign in</Link>
              <Link to="/register" className="cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-on-primary bg-primary text-center">Join</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
