import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Magnetic from './Magnetic';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] px-8 md:px-16 flex items-center justify-between transition-all duration-700 ease-out ${
        scrolled
          ? 'py-5 bg-[#030005]/80 backdrop-blur-3xl border-b border-white/[0.03] shadow-[0_4px_40px_rgba(0,0,0,0.5)]'
          : 'py-8 bg-transparent border-b border-transparent'
      }`}
    >
      {/* Logo */}
      <Magnetic strength={0.2}>
        <Link
          to="/"
          className="text-xl font-display font-black tracking-[-0.05em] text-white select-none"
        >
          YelpCamp
        </Link>
      </Magnetic>

      {/* Navigation */}
      <div className="flex items-center gap-10">
        <Magnetic strength={0.4}>
          <Link
            to="/index"
            className={`text-[10px] font-bold uppercase tracking-[0.4em] transition-all duration-500 ${
              location.pathname === '/index'
                ? 'text-white'
                : 'text-white/20 hover:text-white/80'
            }`}
          >
            Explore
          </Link>
        </Magnetic>

        {user && (
          <Magnetic strength={0.4}>
            <Link
              to="/dashboard"
              className={`text-[10px] font-bold uppercase tracking-[0.4em] transition-all duration-500 ${
                location.pathname === '/dashboard'
                  ? 'text-white'
                  : 'text-white/20 hover:text-white/80'
              }`}
            >
              Dashboard
            </Link>
          </Magnetic>
        )}

        {user ? (
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-full border border-white/20 p-[1px] overflow-hidden group-hover:border-indigo-400 transition-colors">
                <img 
                  src={user.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`} 
                  alt={user.username} 
                  className="w-full h-full object-cover rounded-full" 
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
                  }}
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 group-hover:text-white transition-colors hidden md:inline">
                {user.username}
              </span>
            </Link>
            <Magnetic strength={0.5}>
              <button
                onClick={handleLogout}
                className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white border border-white/[0.05] hover:border-white/[0.15] rounded-full transition-all duration-500"
              >
                Log Out
              </button>
            </Magnetic>
          </div>
        ) : (
          <div className="flex items-center gap-8">
            <Magnetic strength={0.4}>
              <Link
                to="/login"
                className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-all duration-500 ${
                  location.pathname === '/login'
                    ? 'text-white'
                    : 'text-white/20 hover:text-white/80'
                }`}
              >
                In
              </Link>
            </Magnetic>
            <Magnetic strength={0.3}>
              <Link
                to="/register"
                className="flex items-center justify-center px-6 py-3 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 hover:bg-white/80 hover:scale-[1.05] active:scale-95"
              >
                Join
              </Link>
            </Magnetic>
          </div>
        )}
      </div>
    </nav>
  );
}
