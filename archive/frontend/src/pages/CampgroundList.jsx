import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import Magnetic from '../components/Magnetic';

/* ───────────────────────────────────────────
   3D TILT CARD COMPONENT
   ─────────────────────────────────────────── */
function TiltCard({ children, className = "" }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const { left, top, width, height } = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - (left + width / 2)) / (width / 2);
    const y = (e.clientY - (top + height / 2)) / (height / 2);
    setTilt({ x: x * 10, y: -y * 10 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-transform duration-200 ease-out ${className}`}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
      }}
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
    const timer = setTimeout(() => {
      fetchCampgrounds();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchCampgrounds]);

  return (
    <div className="min-h-screen relative bg-[#030005]">
      <div className="fixed inset-0 z-0">
        <AmbientAtmosphere />
      </div>

      <div className="relative z-10 pt-44 pb-20 px-8 lg:px-20 max-w-[1600px] mx-auto">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-24">
          <div className="reveal animate-mask-up">
            <p className="text-[10px] font-bold tracking-[0.5em] text-white/40 uppercase mb-4">The Selection</p>
            <h1 className="text-6xl md:text-8xl font-display font-black tracking-tighter leading-[0.85] text-white">
              Global <br />
              <span className="text-white/60">Sanctuaries.</span>
            </h1>
          </div>
          
          <div className="w-full md:w-[450px]">
            <div className="relative group">
              <input
                type="text"
                placeholder="Query coordinates or sector name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-8 py-6 bg-white/[0.02] border border-white/[0.05] focus:border-white/30 rounded-full text-white placeholder-white/20 focus:outline-none focus:bg-white/[0.04] transition-all duration-500 font-light"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mb-16 flex justify-end">
          <Magnetic strength={0.2}>
            <Link
              to="/campgrounds/new"
              className="px-10 py-5 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-500 hover:bg-white/80"
            >
              Add New Site
            </Link>
          </Magnetic>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-40">
            <div className="w-12 h-12 border-2 border-white/10 border-t-white/80 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
            {campgrounds.map((camp, idx) => (
              <TiltCard key={camp.id} className="h-full">
                <Link to={`/campgrounds/${camp.id}`} className="group block h-full bento-card border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] p-0 overflow-hidden relative">
                  {/* Image Container */}
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <img
                      src={camp.image || "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=600"}
                      alt={camp.name}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#030005] via-transparent to-transparent opacity-80"></div>
                    
                    {/* Floating Info */}
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="flex justify-between items-end">
                         <div className="flex-1">
                            <p className="text-[8px] font-black tracking-[0.3em] text-white/40 uppercase mb-1">Authenticated</p>
                            <h3 className="text-2xl font-display font-black text-white leading-tight tracking-tight">
                              {camp.name}
                            </h3>
                         </div>
                         <div className="text-right">
                            <span className="text-white font-black text-lg tracking-tighter">${camp.price}</span>
                         </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom Strip: Social Stats */}
                  <div className="px-6 py-4 flex justify-between items-center bg-white/[0.02] border-t border-white/[0.04]">
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition-all duration-500">
                          <span className="text-white/60 text-xs">▲</span>
                          <span className="text-[10px] font-bold text-white/40 tracking-widest">{camp.votes?.filter(v => v.vote_type === 1).length || 0}</span>
                       </div>
                       <div className="flex items-center gap-1.5 opacity-20">
                          <span className="text-white/40 text-xs">▼</span>
                          <span className="text-[10px] font-bold text-white/40 tracking-widest">{camp.votes?.filter(v => v.vote_type === -1).length || 0}</span>
                       </div>
                    </div>
                    <div className="text-[10px] font-bold text-white/10 uppercase tracking-[0.2em]">{camp.author_username}</div>
                  </div>
                </Link>
              </TiltCard>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && campgrounds.length === 0 && (
          <div className="text-center py-40 glass-titanium-solid rounded-[3rem] border border-white/5">
            <p className="text-white/20 font-bold uppercase tracking-[0.4em] mb-4">No Sanctuaries Found</p>
            <h3 className="text-3xl font-display font-medium text-white/40 italic">Global search returned zero results. Explore other sectors.</h3>
          </div>
        )}
      </div>
    </div>
  );
}
