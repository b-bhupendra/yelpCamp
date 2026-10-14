import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../api';
import Magnetic from '../components/Magnetic';
import Icon from '../components/Icons';

/**
 * DASHBOARD — a calm, high-contrast command centre for wishlists,
 * posts and scouting stats.
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
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.avatar_url) updateAvatar(res.data.avatar_url);
    } catch (err) {
      setAvatarError(err.response?.data?.detail || 'Failed to upload display picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/index/0/social/me/dashboard');
        setStats({
          total_posts: res.data.total_posts,
          total_likes: res.data.total_likes,
          wishlist_count: res.data.wishlist_count,
        });
        setWishlist(res.data.wishlist || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchDashboard();
  }, [user]);

  if (!user) return (
    <div className="min-h-screen pt-44 pb-20 px-8 text-center">
      <p className="text-fg-subtle uppercase tracking-[0.24em] text-sm">Please sign in to view your dashboard.</p>
      <Link to="/login" className="cursor-pointer inline-block mt-6 px-8 py-4 bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.16em]">Sign in</Link>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-border border-t-secondary rounded-full animate-spin" role="status" aria-label="Loading dashboard" />
    </div>
  );

  const statCards = [
    { label: 'Campsites', value: stats.total_posts, Icon: Icon.Tent, accent: false },
    { label: 'Likes received', value: stats.total_likes, Icon: Icon.Star, accent: true },
    { label: 'Wishlist', value: stats.wishlist_count, Icon: Icon.Gem, accent: false },
  ];

  return (
    <div className="min-h-screen pt-36 md:pt-44 pb-20 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-16 flex flex-col md:flex-row md:items-center justify-between gap-8 animate-mask-up">
        <div className="flex items-center gap-6">
          <div className="relative group cursor-pointer">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-primary via-sky-600 to-ink-700 p-[2px] overflow-hidden">
              <img
                src={user.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`}
                alt={`${user.username} avatar`}
                className="w-full h-full object-cover rounded-2xl"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
                }}
              />
            </div>
            <label className="absolute inset-0 rounded-2xl bg-black/70 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <span className="text-xs font-bold uppercase tracking-wide text-secondary">
                {uploadingAvatar ? 'Uploading…' : 'Change'}
              </span>
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="sr-only" disabled={uploadingAvatar} />
            </label>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-secondary uppercase mb-2">Your dashboard</p>
            <h1 className="text-3xl md:text-5xl font-display font-black tracking-tight leading-none text-fg">
              Welcome back, <br />
              <span className="aurora-text">{user.username}</span>
            </h1>
            {avatarError && <p className="text-xs text-destructive mt-2" role="alert">{avatarError}</p>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
        {statCards.map(({ label, value, Icon: Ico, accent }) => (
          <div key={label} className="glass-obsidian-strong p-8 rounded-2xl border border-border relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-7 text-fg-faint/30 group-hover:text-secondary/40 transition-colors" aria-hidden="true">
              <Ico size={30} />
            </div>
            <p className="text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase mb-4">{label}</p>
            <p className={`text-5xl font-display font-black tracking-tight ${accent ? 'text-secondary' : 'text-fg'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Wishlist */}
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-black mb-8 flex items-center justify-between gap-4 tracking-tight text-fg">
            <span>Saved campsites</span>
            <Link to="/index" className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-secondary uppercase tracking-wide font-bold hover:text-fg transition-colors">
              Browse all <Icon.ArrowRight size={14} />
            </Link>
          </h2>
          <div className="space-y-3">
            {wishlist.map((item) => (
              <Link
                key={item.id}
                to={`/campgrounds/${item.id}`}
                className="cursor-pointer flex items-center gap-6 p-4 rounded-2xl border border-border hover:border-border-strong hover:bg-white/[0.03] transition-colors group"
              >
                <div className="w-16 h-16 rounded-xl bg-surface-2 overflow-hidden shrink-0">
                  <img
                    src={item.image || "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=200"}
                    className="w-full h-full object-cover"
                    alt={item.name}
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-fg truncate tracking-tight">{item.name}</p>
                  <p className="text-xs text-fg-subtle uppercase tracking-wide mt-1">Saved</p>
                </div>
                <div className="text-secondary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all">
                  <Icon.ArrowRight size={18} />
                </div>
              </Link>
            ))}
            {wishlist.length === 0 && (
              <div className="p-16 text-center border border-dashed border-border rounded-2xl">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full border border-border flex items-center justify-center text-fg-subtle">
                  <Icon.Gem size={22} />
                </div>
                <p className="text-xs font-semibold text-fg-subtle uppercase tracking-[0.2em]">Nothing saved yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Plan together */}
        <div className="aurora-border p-10 md:p-14 rounded-3xl flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 text-fg-faint/20 rotate-6 group-hover:rotate-0 transition-transform duration-500" aria-hidden="true">
            <Icon.Users size={72} />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-display font-black mb-5 tracking-tight text-fg">Plan together</h2>
            <p className="text-fg-muted mb-8 leading-relaxed max-w-sm text-base">
              Build shared itineraries and vet trails with your group — gear lists, routes and notes in one place.
            </p>
            <Magnetic strength={0.2}>
              <button className="cursor-pointer px-10 py-5 bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.16em] transition-transform duration-200 hover:scale-[1.04] active:scale-95">
                Start a group trip
              </button>
            </Magnetic>
          </div>
        </div>
      </div>
    </div>
  );
}
