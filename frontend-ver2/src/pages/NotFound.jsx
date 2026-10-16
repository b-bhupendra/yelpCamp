import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icons';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import Magnetic from '../components/Magnetic';

export default function NotFound() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/campgrounds?search=${encodeURIComponent(query.trim())}`);
    } else {
      navigate('/campgrounds');
    }
  };

  return (
    <div className="min-h-screen relative bg-background text-fg flex items-center justify-center px-4 sm:px-6">
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <AmbientAtmosphere />
      </div>

      <div className="relative z-10 max-w-xl w-full text-center space-y-8 animate-mask-up">
        {/* Animated Compass Icon */}
        <div className="w-24 h-24 rounded-full bg-surface-2/80 border border-border/80 flex items-center justify-center mx-auto text-secondary shadow-[0_0_50px_rgba(56,189,248,0.25)]">
          <Icon.Compass size={44} className="animate-[spin_12s_linear_infinite]" />
        </div>

        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-400">
            Coordinates Unknown
          </span>
          <h1 className="text-4xl sm:text-6xl font-display font-black tracking-tight text-fg">
            404 — Trail Lost.
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-fg-muted max-w-md mx-auto leading-relaxed">
            The campsite, story, or clearing you are looking for has shifted off the backcountry map or does not exist.
          </p>
        </div>

        {/* Quick Search Trail Input */}
        <form onSubmit={handleSearchSubmit} className="max-w-md mx-auto">
          <div className="relative group">
            <input
              type="text"
              placeholder="Search campsites by name or terrain…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-5 pr-12 py-3.5 bg-surface border border-border focus:border-secondary rounded-full text-xs sm:text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-fg-subtle hover:text-secondary cursor-pointer transition-colors"
            >
              <Icon.Search size={18} />
            </button>
          </div>
        </form>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Magnetic strength={0.2}>
            <Link
              to="/campgrounds"
              className="cursor-pointer w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 min-h-[44px] rounded-full bg-primary text-on-primary font-bold text-xs uppercase tracking-wider hover:bg-secondary transition-all active:scale-95 shadow-lg shadow-sky-500/20"
            >
              <Icon.Compass size={16} />
              <span>Explore All Campsites</span>
            </Link>
          </Magnetic>

          <Link
            to="/"
            className="cursor-pointer w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 min-h-[44px] rounded-full border border-border hover:border-secondary text-fg-muted hover:text-fg font-semibold text-xs uppercase tracking-wider transition-colors"
          >
            <span>Return to Homepage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
