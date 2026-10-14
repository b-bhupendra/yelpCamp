import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../api';
import Magnetic from '../components/Magnetic';

/**
 * DASHBOARD [SCOUT COMMAND CENTER]
 * A centralized high-end UI for tracking wishlists, own posts, and scouting stats.
 */
export default function Dashboard() {
  const { user, updateAvatar } = useAuth();
  const [stats, setStats] = useState({ total_posts: 0, total_likes: 0, wishlist_count: 0 });
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.avatar_url) {
        updateAvatar(res.data.avatar_url);
      }
    } catch (err) {
      setAvatarError(err.response?.data?.detail || 'Failed to upload display picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
       try {
         // Using a consistent ID for the social router (0 is a dummy for 'me')
         const res = await api.get('/index/0/social/me/dashboard');
         setStats({
           total_posts: res.data.total_posts,
           total_likes: res.data.total_likes,
           wishlist_count: res.data.wishlist_count
         });
         setWishlist(res.data.wishlist || []);
         setLoading(false);
       } catch (err) {
         console.error(err);
         setLoading(false);
       }
    };
    if (user) fetchDashboard();
  }, [user]);

  if (!user) return (
    <div className="min-h-screen pt-44 pb-20 px-8 text-center text-white/20 uppercase tracking-[0.5em] font-bold">
      Access Denied. Initialize Session.
    </div>
  );

  if (loading) return (
     <div className="min-h-screen bg-[#030005] flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
     </div>
  );

  return (
    <div className="min-h-screen pt-44 pb-20 px-8 lg:px-20 max-w-7xl mx-auto">
      {/* Header with Avatar & DP Upload */}
      <div className="mb-20 flex flex-col md:flex-row md:items-center justify-between gap-8 reveal animate-mask-up">
        <div className="flex items-center gap-6">
          <div className="relative group cursor-pointer">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-[2rem] bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-950 p-[2px] shadow-[0_10px_35px_rgba(79,70,229,0.35)] overflow-hidden">
              <img 
                src={user.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`} 
                alt={user.username} 
                className="w-full h-full object-cover rounded-[2rem]" 
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
                }}
              />
            </div>
            <label className="absolute inset-0 rounded-[2rem] bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer p-2 backdrop-blur-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">
                {uploadingAvatar ? 'Uploading...' : 'Change DP'}
              </span>
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" disabled={uploadingAvatar} />
            </label>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.6em] text-indigo-400 uppercase mb-2">Tactical Command</p>
            <h1 className="text-4xl md:text-6xl font-display font-black tracking-tighter leading-none">
              Welcome back, <br />
              <span className="text-indigo-400">{user.username}</span>
            </h1>
            {avatarError && <p className="text-xs text-red-400 mt-2">{avatarError}</p>}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
        <div className="glass-obsidian-strong p-10 rounded-[3rem] border border-white/5 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 text-4xl opacity-5 group-hover:opacity-10 transition-opacity">🚀</div>
           <p className="text-[10px] font-bold tracking-[0.4em] text-white/20 uppercase mb-4">Expeditions</p>
           <p className="text-5xl font-display font-black tracking-tighter">{stats.total_posts}</p>
        </div>
        <div className="glass-obsidian-strong p-10 rounded-[3rem] border border-white/5 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 text-4xl opacity-5 group-hover:opacity-10 transition-opacity">💎</div>
           <p className="text-[10px] font-bold tracking-[0.4em] text-white/20 uppercase mb-4">Social Impact</p>
           <p className="text-5xl font-display font-black tracking-tighter text-indigo-400">{stats.total_likes} <span className="text-xs uppercase tracking-widest text-white/20">Received</span></p>
        </div>
        <div className="glass-obsidian-strong p-10 rounded-[3rem] border border-white/5 bg-indigo-500/5 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 text-4xl opacity-5 group-hover:opacity-10 transition-opacity">⚡</div>
           <p className="text-[10px] font-bold tracking-[0.4em] text-white/20 uppercase mb-4">Wishlist</p>
           <p className="text-5xl font-display font-black tracking-tighter">{stats.wishlist_count}</p>
        </div>
      </div>

      {/* Action Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Wishlist Tracking */}
        <div>
           <h2 className="text-3xl font-display font-black mb-10 flex items-center justify-between tracking-tighter">
             <span>Tracked Sanctuaries</span>
             <Link to="/index" className="text-[10px] text-indigo-400 uppercase tracking-[0.3em] font-black hover:text-white transition-colors">Expand Intelligence</Link>
           </h2>
           <div className="space-y-4">
              {wishlist.map(item => (
                <Link key={item.id} to={`/campgrounds/${item.id}`} className="flex items-center gap-8 p-6 rounded-[2.5rem] border border-white/5 hover:bg-white/[0.03] transition-all group bento-card">
                   <div className="w-20 h-20 rounded-2xl bg-white/5 overflow-hidden">
                      <img src={item.image || "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=200"} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt={item.name} />
                   </div>
                   <div className="flex-1">
                      <p className="font-bold text-lg text-white/80 group-hover:text-white transition-colors tracking-tight">{item.name}</p>
                      <p className="text-[10px] text-white/10 uppercase font-black tracking-widest mt-1">Status: Operational</p>
                   </div>
                   <div className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
                   </div>
                </Link>
              ))}
              {wishlist.length === 0 && (
                 <div className="p-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                    <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.4em]">No data tracked.</p>
                 </div>
              )}
           </div>
        </div>

        {/* Squad Sync (Collaboration) */}
        <div className="bg-indigo-500/[0.03] p-16 rounded-[4rem] border border-indigo-500/10 flex flex-col justify-center relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-12 text-8xl opacity-5 grayscale group-hover:grayscale-0 transition-all duration-1000 rotate-12 group-hover:rotate-0">🤝</div>
           <div className="relative z-10">
              <h2 className="text-4xl font-display font-black mb-6 tracking-tighter">Squad Sync</h2>
              <p className="text-white/30 mb-10 leading-relaxed max-w-sm font-light text-lg italic">
                Plan collective expeditions with your circle. Shared itineraries, live telemetrics, and group-vetted trails.
              </p>
              <Magnetic strength={0.2}>
                <button className="px-12 py-6 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(255,255,255,0.05)] hover:scale-105 transition-all">
                  Initialize Squad Trip
                </button>
              </Magnetic>
           </div>
        </div>
      </div>
    </div>
  );
}
