import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import Magnetic from '../components/Magnetic';
import Icon from '../components/Icons';

/* ───────────────────────────────────────────
   3D TILT CARD — fine-pointer + motion-safe only
   ─────────────────────────────────────────── */
function TiltCard({ children, className = "" }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnabled(fine && !reduced);
  }, []);

  const handleMouseMove = (e) => {
    if (!enabled || !cardRef.current) return;
    const { left, top, width, height } = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - (left + width / 2)) / (width / 2);
    const y = (e.clientY - (top + height / 2)) / (height / 2);
    setTilt({ x: x * 8, y: -y * 8 });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-transform duration-200 ease-out ${className}`}
      style={{ transform: `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)` }}
    >
      {children}
    </div>
  );
}

export default function CampgroundList() {
  const [campgrounds, setCampgrounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCampgrounds = useCallback(async () => {
    try {
      const res = await api.get(`/index/?search=${search}`);
      setCampgrounds(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchCampgrounds, 300);
    return () => clearTimeout(timer);
  }, [fetchCampgrounds]);

  return (
    <div className="min-h-screen relative bg-background">
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <AmbientAtmosphere />
      </div>

      <div className="relative z-10 pt-36 md:pt-44 pb-20 px-6 md:px-12 lg:px-20 max-w-[1600px] mx-auto">

        {/* Header & Search */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-16">
          <div className="animate-mask-up">
            <p className="text-xs font-bold tracking-[0.3em] text-secondary uppercase mb-4">The selection</p>
            <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-[0.9] text-fg">
              Global <br />
              <span className="aurora-text">sanctuaries.</span>
            </h1>
          </div>

          <div className="w-full lg:w-[420px]">
            <label htmlFor="site-search" className="sr-only">Search campsites</label>
            <div className="relative group">
              <input
                id="site-search"
                type="text"
                placeholder="Search by name or region…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-6 pr-14 py-4 bg-surface border border-border focus:border-secondary rounded-full text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors duration-200"
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within:text-secondary transition-colors">
                <Icon.Search size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mb-12 flex justify-end">
          <Magnetic strength={0.2}>
            <Link
              to="/campgrounds/new"
              className="cursor-pointer inline-flex items-center gap-2.5 px-8 py-4 bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.16em] transition-transform duration-200 hover:scale-[1.04] active:scale-95"
            >
              <Icon.Plus size={16} />
              Add campsite
            </Link>
          </Magnetic>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-40">
            <div className="w-12 h-12 border-2 border-border border-t-secondary rounded-full animate-spin" role="status" aria-label="Loading campsites" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 md:gap-8">
            {campgrounds.map((camp) => {
              const likes = camp.votes?.filter((v) => v.vote_type === 1).length || 0;
              const dislikes = camp.votes?.filter((v) => v.vote_type === -1).length || 0;
              return (
                <TiltCard key={camp.id} className="h-full">
                  <Link
                    to={`/campgrounds/${camp.id}`}
                    className="cursor-pointer group block h-full bento-card p-0 overflow-hidden relative"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <img
                        src={camp.image || "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=600"}
                        alt={camp.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

                      <div className="absolute bottom-5 left-5 right-5">
                        <div className="flex justify-between items-end gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-secondary uppercase mb-1.5">
                              <Icon.MapPin size={13} /> Verified
                            </p>
                            <h3 className="text-xl font-display font-bold text-fg leading-tight tracking-tight truncate">
                              {camp.name}
                            </h3>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-fg font-black text-lg tracking-tight">${camp.price}</span>
                            <span className="block text-xs text-fg-subtle">/night</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom strip: social stats */}
                    <div className="px-5 py-3.5 flex justify-between items-center bg-surface-2/60 border-t border-border">
                      <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1.5 text-fg-muted">
                          <Icon.ArrowUp size={14} className="text-secondary" />
                          <span className="text-xs font-semibold">{likes}</span>
                          <span className="sr-only">likes</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-fg-subtle">
                          <Icon.ArrowDown size={14} />
                          <span className="text-xs font-semibold">{dislikes}</span>
                          <span className="sr-only">dislikes</span>
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-fg-subtle truncate max-w-[45%]">
                        {camp.author_username}
                      </div>
                    </div>
                  </Link>
                </TiltCard>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && campgrounds.length === 0 && (
          <div className="text-center py-24 glass-obsidian-strong rounded-3xl border border-border">
            <div className="mx-auto mb-6 w-14 h-14 rounded-full border border-border flex items-center justify-center text-fg-subtle">
              <Icon.Compass size={26} />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-fg-muted mb-3">No campsites found</p>
            <h3 className="text-2xl font-display font-medium text-fg-subtle">Try a different name or region.</h3>
          </div>
        )}
      </div>
    </div>
  );
}
