import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import api from '../api';
import Magnetic from '../components/Magnetic';
import Icon from '../components/Icons';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';

/**
 * DASHBOARD — a calm, high-contrast command centre for wishlists,
 * posts and scouting stats.
 */
export default function Dashboard() {
  const { user, updateAvatar } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState({ total_posts: 0, total_likes: 0, wishlist_count: 0 });
  const [wishlist, setWishlist] = useState([]);
  const [myCampgrounds, setMyCampgrounds] = useState([]);
  const [myMoments, setMyMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [activeTab, setActiveTab] = useState('hosted'); // 'hosted' | 'saved' | 'moments'

  const fetchMyMoments = async () => {
    try {
      const res = await api.get('/api/stories');
      const allStories = Array.isArray(res.data) ? res.data : (res.data.stories || []);
      const userStory = allStories.find(
        (s) => s.user_id === user?.id || s.username === user?.username || s.user_username === user?.username
      );
      setMyMoments(userStory?.photos || []);
    } catch (err) {
      console.error('Failed to load my moments:', err);
    }
  };

  const handleDeleteMoment = async (photoId) => {
    if (!window.confirm('Are you sure you want to delete this moment?')) return;
    try {
      await api.delete(`/api/stories/${photoId}`);
      setMyMoments((prev) => prev.filter((m) => m.id !== photoId));
      toast.success('Field moment deleted.');
    } catch (err) {
      console.error('Failed to delete moment:', err);
      toast.error('Failed to delete moment.');
    }
  };

  const handleDeleteCampground = async (campId) => {
    if (!window.confirm('Delete this campsite listing? This cannot be undone.')) return;
    try {
      await api.delete(`/api/campgrounds/${campId}`);
      setMyCampgrounds((prev) => prev.filter((c) => c.id !== campId));
      setStats((prev) => ({ ...prev, total_posts: Math.max(0, prev.total_posts - 1) }));
      toast.success('Campsite listing removed.');
    } catch (err) {
      console.error('Failed to delete campsite:', err);
      toast.error('Failed to delete campsite listing.');
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.avatar_url) {
        updateAvatar(res.data.avatar_url);
        toast.success('Profile avatar updated successfully.');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to upload display picture';
      setAvatarError(msg);
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/api/me/dashboard');
        setStats({
          total_posts: res.data.total_posts,
          total_likes: res.data.total_likes,
          wishlist_count: res.data.wishlist_count,
        });
        setWishlist(res.data.wishlist || []);
        setMyCampgrounds(res.data.my_campgrounds || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchDashboard();
      fetchMyMoments();
    }
  }, [user]);

  if (!user) return (
    <div className="min-h-screen pt-44 pb-20 px-8 text-center">
      <p className="text-fg-subtle uppercase tracking-[0.24em] text-sm">Please sign in to view your dashboard.</p>
      <Link to="/login" className="cursor-pointer inline-block mt-6 px-8 py-4 bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.16em]">Sign in</Link>
    </div>
  );

  if (loading) return <DashboardSkeleton />;

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
        {/* Left Column: Tabbed Content (Saved Campsites & My Moments) */}
        <div>
          {/* Tab Switcher */}
          <div className="flex items-center gap-4 sm:gap-6 mb-8 border-b border-border/70 pb-3 overflow-x-auto">
            <button
              type="button"
              id="tab-hosted-campsites"
              onClick={() => setActiveTab('hosted')}
              className={`cursor-pointer pb-2 font-display font-bold text-base sm:text-xl tracking-tight transition-colors relative shrink-0 flex items-center gap-2 ${
                activeTab === 'hosted'
                  ? 'text-fg'
                  : 'text-fg-subtle hover:text-fg-muted'
              }`}
            >
              <span>My Hosted Campsites</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-black">
                {myCampgrounds.length}
              </span>
              {activeTab === 'hosted' && (
                <span className="absolute bottom-[-13px] inset-x-0 h-0.5 bg-secondary rounded-full" />
              )}
            </button>

            <button
              type="button"
              id="tab-saved-campsites"
              onClick={() => setActiveTab('saved')}
              className={`cursor-pointer pb-2 font-display font-bold text-base sm:text-xl tracking-tight transition-colors relative shrink-0 flex items-center gap-2 ${
                activeTab === 'saved'
                  ? 'text-fg'
                  : 'text-fg-subtle hover:text-fg-muted'
              }`}
            >
              <span>Saved Campsites</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-black">
                {wishlist.length}
              </span>
              {activeTab === 'saved' && (
                <span className="absolute bottom-[-13px] inset-x-0 h-0.5 bg-secondary rounded-full" />
              )}
            </button>

            <button
              type="button"
              id="tab-my-moments"
              onClick={() => setActiveTab('moments')}
              className={`cursor-pointer pb-2 font-display font-bold text-base sm:text-xl tracking-tight transition-colors relative shrink-0 flex items-center gap-2 ${
                activeTab === 'moments'
                  ? 'text-fg'
                  : 'text-fg-subtle hover:text-fg-muted'
              }`}
            >
              <span>My Field Moments</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-black">
                {myMoments.length}
              </span>
              {activeTab === 'moments' && (
                <span className="absolute bottom-[-13px] inset-x-0 h-0.5 bg-secondary rounded-full" />
              )}
            </button>
          </div>

          {/* TAB 1: My Hosted Campsites */}
          {activeTab === 'hosted' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2">
                <p className="text-xs uppercase tracking-[0.2em] text-fg-subtle">Your active campsite listings</p>
                <Link
                  to="/campgrounds/new"
                  id="btn-host-new-campsite"
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full bg-secondary/15 text-secondary hover:bg-secondary/25 text-xs font-bold transition-colors"
                >
                  <Icon.Plus size={14} /> Host New
                </Link>
              </div>

              {myCampgrounds.map((camp) => (
                <div
                  key={camp.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/80 bg-surface/60 hover:border-border-strong transition-all duration-200 group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-surface-2 overflow-hidden shrink-0 border border-border">
                      <img
                        src={camp.image || "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=200"}
                        className="w-full h-full object-cover"
                        alt={camp.title || camp.name}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=200";
                        }}
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Link
                        to={`/campgrounds/${camp.id}`}
                        className="font-bold text-base text-fg hover:text-secondary truncate tracking-tight block"
                      >
                        {camp.title || camp.name}
                      </Link>
                      <p className="text-xs text-fg-subtle truncate flex items-center gap-1">
                        <Icon.MapPin size={12} /> {camp.location_address || 'Backcountry wilderness'}
                      </p>
                      <div className="flex items-center gap-3 text-xs pt-1">
                        <span className="font-semibold text-secondary">${camp.price}<span className="text-[10px] text-fg-subtle font-normal">/night</span></span>
                        <span className="flex items-center gap-1 text-amber-400 font-medium">
                          <Icon.Star size={11} className="fill-amber-400" /> {camp.avg_rating ? camp.avg_rating.toFixed(1) : 'New'}
                        </span>
                        <span className="text-fg-subtle text-[11px] flex items-center gap-1">
                          <Icon.Heart size={11} /> {camp.likes_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Link
                      to={`/campgrounds/${camp.id}`}
                      className="w-11 h-11 flex items-center justify-center rounded-xl border border-border hover:border-secondary/50 bg-surface-2/40 text-fg-muted hover:text-secondary transition-colors"
                      title="View listing"
                    >
                      <Icon.Eye size={16} />
                    </Link>
                    <Link
                      to={`/campgrounds/${camp.id}/edit`}
                      id={`btn-edit-camp-${camp.id}`}
                      className="w-11 h-11 flex items-center justify-center rounded-xl border border-border hover:border-sky-400/50 bg-surface-2/40 text-fg-muted hover:text-sky-400 transition-colors"
                      title="Edit property details"
                    >
                      <Icon.Edit3 size={16} />
                    </Link>
                    <button
                      type="button"
                      id={`btn-delete-camp-${camp.id}`}
                      onClick={() => handleDeleteCampground(camp.id)}
                      className="w-11 h-11 flex items-center justify-center rounded-xl border border-border hover:border-destructive/40 bg-surface-2/40 text-fg-muted hover:text-destructive transition-colors cursor-pointer"
                      title="Delete listing"
                    >
                      <Icon.Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {myCampgrounds.length === 0 && (
                <div className="p-16 text-center border border-dashed border-border rounded-2xl">
                  <div className="mx-auto mb-4 w-12 h-12 rounded-full border border-border flex items-center justify-center text-fg-subtle">
                    <Icon.Tent size={22} />
                  </div>
                  <p className="text-xs font-semibold text-fg-subtle uppercase tracking-[0.2em] mb-2">No hosted campsites yet</p>
                  <p className="text-xs text-fg-muted max-w-xs mx-auto mb-6">
                    List your wilderness land or camp spot with our multi-photo gallery, amenities, and terrain rules.
                  </p>
                  <Link
                    to="/campgrounds/new"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary font-bold text-xs uppercase tracking-[0.16em] hover:opacity-90 transition-opacity"
                  >
                    <Icon.Plus size={14} /> Host Campsite
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Saved Campsites */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              {wishlist.map((item) => (
                <Link
                  key={item.id}
                  to={`/campgrounds/${item.id}`}
                  className="cursor-pointer flex items-center gap-5 p-4 rounded-2xl border border-border hover:border-border-strong hover:bg-white/[0.03] transition-colors group"
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
          )}

          {/* TAB 2: My Field Moments */}
          {activeTab === 'moments' && (
            <div className="space-y-4">
              {myMoments.map((moment) => (
                <div
                  key={moment.id}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-border/80 bg-surface/60 hover:border-border-strong transition-all duration-200 group"
                >
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl bg-surface-2 overflow-hidden shrink-0 border border-border">
                    <img
                      src={moment.image_url}
                      className="w-full h-full object-cover"
                      alt={moment.caption || 'Moment'}
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-sm text-fg truncate">
                      {moment.caption || 'Backcountry Moment'}
                    </p>
                    {moment.campground_title && (
                      <p className="text-xs text-secondary truncate flex items-center gap-1">
                        <Icon.MapPin size={12} /> {moment.campground_title}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-fg-subtle pt-1">
                      <span className="flex items-center gap-1 text-rose-400 font-medium">
                        <Icon.Heart size={12} className="fill-rose-400" /> {moment.likes_count || 0}
                      </span>
                      <span>Permanent</span>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    id={`btn-delete-moment-${moment.id}`}
                    onClick={() => handleDeleteMoment(moment.id)}
                    aria-label="Delete this moment"
                    className="w-11 h-11 flex items-center justify-center rounded-xl border border-border hover:border-destructive/40 bg-surface-2/40 text-fg-subtle hover:text-destructive transition-colors cursor-pointer shrink-0"
                    title="Delete moment"
                  >
                    <Icon.Trash2 size={16} />
                  </button>
                </div>
              ))}

              {myMoments.length === 0 && (
                <div className="p-16 text-center border border-dashed border-border rounded-2xl">
                  <div className="mx-auto mb-4 w-12 h-12 rounded-full border border-border flex items-center justify-center text-fg-subtle">
                    <Icon.Camera size={22} />
                  </div>
                  <p className="text-xs font-semibold text-fg-subtle uppercase tracking-[0.2em] mb-2">
                    No field moments yet
                  </p>
                  <p className="text-xs text-fg-muted max-w-xs mx-auto">
                    Share photos from any campsite. Your moments stay active permanently until you delete them.
                  </p>
                </div>
              )}
            </div>
          )}
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
