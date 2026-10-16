import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useVote } from '../hooks/useVote';
import { useWishlist } from '../hooks/useWishlist';
import CampgroundDetailsSkeleton from '../components/skeletons/CampgroundDetailsSkeleton';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import Magnetic from '../components/Magnetic';
import Icon from '../components/Icons';
import StoryBar from '../components/stories/StoryBar';
import ThreadedComments from '../components/comments/ThreadedComments';
import SharePropertyModal from '../components/SharePropertyModal';
import { useAgentAction } from '../hooks/useAgentAction';

const AMENITY_METADATA = {
  tent_pitches: { label: 'Tent Pitches', icon: Icon.Tent },
  campfire: { label: 'Campfire Allowed', icon: Icon.Flame },
  hot_showers: { label: 'Hot Showers', icon: Icon.Droplet },
  potable_water: { label: 'Potable Water', icon: Icon.Droplet },
  wifi: { label: 'WiFi Access', icon: Icon.Zap },
  pet_friendly: { label: 'Pet Friendly', icon: Icon.Users },
  electricity: { label: 'Solar / Grid Power', icon: Icon.Zap },
};

export default function CampgroundDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [campground, setCampground] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Optimistic voting hook
  const {
    likes,
    dislikes,
    userVote,
    castVote,
    setStats,
  } = useVote({
    campgroundId: id,
    initialLikes: 0,
    initialDislikes: 0,
    initialUserVote: 0,
  });

  // Optimistic wishlist hook
  const {
    isWishlisted,
    setIsWishlisted,
    toggleWishlist,
    loading: wishlistLoading,
  } = useWishlist({
    campgroundId: id,
    initialWishlisted: false,
  });

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowRight' && campground) {
        const total = [campground.image, ...(campground.gallery_images || [])].filter(Boolean).length;
        setLightboxIndex((prev) => (prev + 1) % total);
      } else if (e.key === 'ArrowLeft' && campground) {
        const total = [campground.image, ...(campground.gallery_images || [])].filter(Boolean).length;
        setLightboxIndex((prev) => (prev - 1 + total) % total);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, campground]);

  const fetchCampground = useCallback(async () => {
    try {
      const res = await api.get(`/api/campgrounds/${id}`);
      setCampground(res.data);
      if (res.data.is_wishlisted !== undefined) {
        setIsWishlisted(Boolean(res.data.is_wishlisted));
      }
      const statsRes = await api.get(`/api/campgrounds/${id}/stats`);
      setStats({
        likes: statsRes.data.likes,
        dislikes: statsRes.data.dislikes,
        user_vote: statsRes.data.user_vote,
      });
    } catch (err) {
      console.error(err);
      toast.error('Could not load campsite details.');
    } finally {
      setLoading(false);
    }
  }, [id, setStats, setIsWishlisted, toast]);

  useEffect(() => {
    fetchCampground();
  }, [fetchCampground]);

  // Register Agent Actions for AI Co-Pilot
  useAgentAction({
    id: 'open_share_modal',
    description: 'Opens the share suite and offline QR code for this campsite',
    parameters: { type: 'object', properties: {} },
    handler: () => {
      setIsShareOpen(true);
      return { status: 'opened', modal: 'SharePropertyModal' };
    },
  });

  useAgentAction({
    id: 'scroll_to_reviews',
    description: 'Scrolls smoothly down to the campsite reviews and discussion threads',
    parameters: { type: 'object', properties: {} },
    handler: () => {
      const el = document.getElementById('section-comments');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return { status: 'scrolled', target: 'section-comments' };
    },
  });

  const handleCommentSubmit = async ({ text, rating, parentCommentId }) => {
    if (!user) {
      toast.warning('Please log in to leave a review.');
      return navigate('/login');
    }
    try {
      await api.post(`/api/campgrounds/${id}/comments`, {
        text,
        rating,
        parent_comment_id: parentCommentId,
      });
      toast.success(parentCommentId ? 'Reply submitted.' : 'Review posted successfully.');
      fetchCampground();
    } catch (err) {
      console.error(err);
      toast.error('Could not post comment. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this campsite? This cannot be undone.')) return;
    try {
      await api.delete(`/api/campgrounds/${id}`);
      toast.success('Campsite deleted successfully.');
      navigate('/campgrounds');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete campsite.');
    }
  };

  if (loading) {
    return <CampgroundDetailsSkeleton />;
  }

  if (!campground) {
    return (
      <div className="min-h-screen bg-background pt-40 px-8 text-center flex flex-col items-center justify-center">
        <p className="text-fg-subtle uppercase tracking-[0.24em] text-sm mb-4">Campsite not found</p>
        <Link
          to="/campgrounds"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-surface-2 border border-border text-xs font-semibold uppercase tracking-wider text-fg hover:border-secondary transition-all"
        >
          <Icon.ArrowLeft size={16} /> Return to Map
        </Link>
      </div>
    );
  }

  const likedBy = campground.liked_by || [];
  const gallery = [
    campground.image,
    ...(Array.isArray(campground.gallery_images) ? campground.gallery_images : []),
  ].filter(Boolean);

  const amenitiesList = campground.amenities || [];
  const rules = campground.rules || {};

  return (
    <div className="min-h-screen bg-background text-fg">
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <AmbientAtmosphere />
      </div>

      <div className="relative z-10 pt-32 sm:pt-40 pb-24 px-4 sm:px-8 md:px-12 lg:px-16 max-w-7xl mx-auto space-y-10">

        {/* TOP STORY BAR: Visitor Moments & Backcountry Stories for this campground */}
        <div className="glass-obsidian rounded-3xl p-5 sm:p-6 border border-border/70 relative shadow-2xl">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="font-display font-bold text-xs sm:text-sm uppercase tracking-wider text-fg">
                Visitor Moments & Stories
              </h2>
            </div>
            <span className="text-[11px] text-fg-subtle">Permanent field highlights</span>
          </div>
          <StoryBar
            campgroundId={id}
            campgroundTitle={campground.title || campground.name}
            onStoryUpdated={fetchCampground}
          />
        </div>

        {/* MAIN GRID: Left Details & Bento Gallery, Right Reviews */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* LEFT COLUMN: Visuals, Specs, Amenities */}
          <div className="lg:col-span-7 space-y-8">
            {/* 5-Photo Responsive Bento Grid Gallery */}
            <div className="relative">
              {gallery.length === 1 ? (
                /* Single Image Hero */
                <div
                  onClick={() => setLightboxIndex(0)}
                  className="relative rounded-3xl overflow-hidden aspect-[16/10] border border-border/80 shadow-2xl bg-surface cursor-pointer group"
                >
                  <img
                    src={gallery[0]}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    alt={campground.title || campground.name}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  {campground.avg_rating && (
                    <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 border border-white/15 text-amber-400 text-xs font-bold backdrop-blur-md shadow-lg">
                      <Icon.Star size={13} className="fill-amber-400 text-amber-400" />
                      <span>{Number(campground.avg_rating).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Multi-Photo Bento Grid */
                <div className="grid grid-cols-2 sm:grid-cols-4 sm:grid-rows-2 gap-2.5 h-[340px] sm:h-[420px] rounded-3xl overflow-hidden border border-border/80 shadow-2xl relative bg-surface p-1">
                  {/* Hero Large Photo (Left half on desktop) */}
                  <div
                    onClick={() => setLightboxIndex(0)}
                    className="col-span-2 row-span-2 relative rounded-2xl overflow-hidden cursor-pointer group"
                  >
                    <img
                      src={gallery[0]}
                      alt="Campsite hero"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                    {campground.avg_rating && (
                      <div className="absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 border border-white/15 text-amber-400 text-xs font-bold backdrop-blur-md shadow-lg">
                        <Icon.Star size={13} className="fill-amber-400 text-amber-400" />
                        <span>{Number(campground.avg_rating).toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Quadrant Photo 1 */}
                  {gallery[1] && (
                    <div
                      onClick={() => setLightboxIndex(1)}
                      className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden cursor-pointer group"
                    >
                      <img
                        src={gallery[1]}
                        alt="Campsite perspective 2"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors" />
                    </div>
                  )}

                  {/* Quadrant Photo 2 */}
                  {gallery[2] && (
                    <div
                      onClick={() => setLightboxIndex(2)}
                      className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden cursor-pointer group"
                    >
                      <img
                        src={gallery[2]}
                        alt="Campsite perspective 3"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors" />
                    </div>
                  )}

                  {/* Quadrant Photo 3 */}
                  {gallery[3] && (
                    <div
                      onClick={() => setLightboxIndex(3)}
                      className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden cursor-pointer group hidden sm:block"
                    >
                      <img
                        src={gallery[3]}
                        alt="Campsite perspective 4"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors" />
                    </div>
                  )}

                  {/* Quadrant Photo 4 (with +N more overlay if > 5) */}
                  {gallery[4] && (
                    <div
                      onClick={() => setLightboxIndex(4)}
                      className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden cursor-pointer group hidden sm:block"
                    >
                      <img
                        src={gallery[4]}
                        alt="Campsite perspective 5"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {gallery.length > 5 ? (
                        <div className="absolute inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center text-white font-display font-bold text-sm tracking-wide group-hover:bg-black/50 transition-colors">
                          +{gallery.length - 5} More
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors" />
                      )}
                    </div>
                  )}

                  {/* View All Photos Action Button */}
                  <button
                    type="button"
                    id="btn-view-all-photos"
                    onClick={() => setLightboxIndex(0)}
                    className="absolute bottom-4 right-4 z-10 cursor-pointer inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-md border border-white/20 transition-all hover:scale-105 shadow-xl"
                  >
                    <Icon.Image size={15} />
                    <span>View all ({gallery.length})</span>
                  </button>
                </div>
              )}
            </div>

            {/* Campground Overview Card */}
            <div className="glass-obsidian rounded-3xl p-6 sm:p-8 md:p-10 space-y-7 border border-border/70 shadow-xl">
              {/* Header & Share/Wishlist Actions */}
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div className="space-y-1">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
                    <Icon.MapPin size={14} /> {campground.location_address || 'Wilderness Zone'}
                  </p>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-black tracking-tight text-fg">
                    {campground.title || campground.name}
                  </h1>
                </div>

                <div className="flex items-center gap-3">
                  {/* Wishlist Button */}
                  <button
                    type="button"
                    id="btn-wishlist-toggle"
                    onClick={() => toggleWishlist()}
                    disabled={wishlistLoading}
                    className={`cursor-pointer inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-full border transition-all active:scale-95 shadow-sm ${
                      isWishlisted
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 hover:bg-rose-500/25'
                        : 'border-border hover:border-secondary/60 bg-surface/60 hover:bg-surface text-fg-muted hover:text-fg'
                    }`}
                    aria-label={isWishlisted ? 'Remove from expedition wishlist' : 'Save to expedition wishlist'}
                  >
                    <Icon.Heart size={15} className={isWishlisted ? 'fill-rose-400 text-rose-400' : 'text-fg-muted'} />
                    <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">
                      {isWishlisted ? 'Saved' : 'Wishlist'}
                    </span>
                  </button>

                  {/* Share Property Button */}
                  <button
                    type="button"
                    id="btn-share-property"
                    onClick={() => setIsShareOpen(true)}
                    className="cursor-pointer inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-full border border-border hover:border-secondary/60 bg-surface/60 hover:bg-surface text-xs font-semibold uppercase tracking-wider text-fg-muted hover:text-fg transition-all active:scale-95 shadow-sm"
                  >
                    <Icon.Share2 size={15} className="text-secondary" />
                    <span>Share</span>
                  </button>

                  <div className="text-right ml-1">
                    <p className="text-secondary font-bold text-2xl sm:text-3xl tracking-tight leading-none">
                      ${campground.price}
                      <span className="text-fg-subtle text-xs ml-1 font-normal uppercase tracking-wide">/night</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Social Vote Bar */}
              <div className="flex flex-wrap gap-4 items-center py-4 border-y border-border/60">
                <button
                  type="button"
                  id="btn-upvote"
                  onClick={() => castVote(1)}
                  aria-pressed={userVote === 1}
                  className={`cursor-pointer inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full border transition-colors duration-200 ${
                    userVote === 1
                      ? 'bg-primary border-secondary text-on-primary'
                      : 'border-border hover:border-border-strong text-fg-muted hover:text-fg'
                  }`}
                >
                  <Icon.ArrowUp size={15} />
                  <span className="text-xs font-semibold uppercase tracking-wide">{likes} likes</span>
                </button>

                <button
                  type="button"
                  id="btn-downvote"
                  onClick={() => castVote(-1)}
                  aria-pressed={userVote === -1}
                  className={`cursor-pointer inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full border transition-colors duration-200 ${
                    userVote === -1
                      ? 'bg-destructive/20 border-destructive/40 text-destructive'
                      : 'border-border hover:border-border-strong text-fg-muted hover:text-fg'
                  }`}
                >
                  <Icon.ArrowDown size={15} />
                  <span className="text-xs font-semibold uppercase tracking-wide">{dislikes}</span>
                </button>

                <div className="ml-auto flex -space-x-2">
                  {(likedBy.length > 0 ? likedBy : [101, 102, 103]).map((voter, i) => (
                    <div
                      key={voter.user_id || i}
                      className="w-8 h-8 rounded-full border-2 border-background bg-surface-2 overflow-hidden"
                      title={voter.username ? `@${voter.username}` : 'Explorer'}
                    >
                      <img
                        src={voter.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${voter.username || 'scout_' + i}`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <p className="text-base sm:text-lg text-fg-muted leading-relaxed font-light">
                {campground.description}
              </p>

              {/* Structured Amenities Badges */}
              {amenitiesList.length > 0 && (
                <div className="space-y-3 pt-3">
                  <h3 className="font-display font-bold text-xs uppercase tracking-wider text-fg-subtle">
                    Campsite Amenities
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {amenitiesList.map((amenityKey) => {
                      const meta = AMENITY_METADATA[amenityKey] || {
                        label: amenityKey.replace(/_/g, ' '),
                        icon: Icon.Gem,
                      };
                      const AmenityIcon = meta.icon;
                      return (
                        <div
                          key={amenityKey}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2/60 border border-border/80 text-xs font-medium text-fg shadow-sm"
                        >
                          <AmenityIcon size={14} className="text-secondary" />
                          <span>{meta.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rules Accordion / Card */}
              {rules && Object.keys(rules).length > 0 && (
                <div className="p-4 rounded-2xl bg-surface-2/40 border border-border/60 space-y-2">
                  <h3 className="font-display font-bold text-xs uppercase tracking-wider text-fg-subtle">
                    Terrain Rules & Guidelines
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-fg-muted">
                    {rules.check_in && <div>Check-in: <strong className="text-fg">{rules.check_in}</strong></div>}
                    {rules.check_out && <div>Check-out: <strong className="text-fg">{rules.check_out}</strong></div>}
                    {rules.max_guests && <div>Max Capacity: <strong className="text-fg">{rules.max_guests} campers</strong></div>}
                    {rules.tent_capacity && <div>Tents: <strong className="text-fg">{rules.tent_capacity} pitches</strong></div>}
                  </div>
                </div>
              )}

              {/* Author & Owner Controls */}
              <div className="pt-6 border-t border-border/60 flex flex-wrap gap-4 justify-between items-center">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-sky-600 p-px overflow-hidden">
                    <img
                      src={
                        campground.author_avatar ||
                        `https://api.dicebear.com/7.x/adventurer/svg?seed=${campground.author_username || 'scout'}`
                      }
                      alt={campground.author_username}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-secondary uppercase leading-none mb-1">
                      Hosted by
                    </p>
                    <p className="text-sm font-bold text-fg">@{campground.author_username}</p>
                  </div>
                </div>

                {user && user.id === campground.author_id && (
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/campgrounds/${id}/edit`}
                      className="cursor-pointer inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-2/60 border border-border/60 text-xs font-semibold uppercase tracking-wider text-fg-muted hover:text-fg hover:border-border transition-colors"
                    >
                      <Icon.Compass size={14} /> Edit
                    </Link>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="cursor-pointer inline-flex items-center min-h-[44px] px-3.5 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-xs font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Threaded Comments Suite */}
          <div id="section-comments" className="lg:col-span-5 space-y-6">
            <div className="glass-obsidian-strong rounded-3xl p-6 sm:p-8 border border-border/80 shadow-2xl relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight leading-none text-fg">
                    Reviews & Trail Q&A
                  </h2>
                  <p className="text-[11px] text-fg-subtle mt-1">
                    Multi-level nested discussions from verified campers
                  </p>
                </div>
                <div className="p-2.5 rounded-full bg-secondary/10 text-secondary">
                  <Icon.MessageCircle size={20} />
                </div>
              </div>

              {/* Threaded Comments Component */}
              <div id="comments-tree">
                <ThreadedComments
                  comments={campground.comments_tree || []}
                  onSubmitComment={handleCommentSubmit}
                  canRate={true}
                  emptyMessage="No reviews yet — be the first to log conditions or ask a question."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Property Modal */}
      <SharePropertyModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        campground={campground}
      />

      {/* Fullscreen Lightbox Modal */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-8 select-none animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          {/* Top Bar: Counter & Close */}
          <div className="flex items-center justify-between z-10">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white/80">
              Photo {lightboxIndex + 1} of {gallery.length}
            </span>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="w-11 h-11 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close photo viewer"
            >
              <Icon.Close size={24} />
            </button>
          </div>

          {/* Center: Main Image with Prev / Next */}
          <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
            {gallery.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxIndex((prev) => (prev - 1 + gallery.length) % gallery.length)}
                className="absolute left-2 sm:left-6 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 transition-all hover:scale-110 cursor-pointer shadow-xl"
                aria-label="Previous photo"
              >
                <Icon.ArrowDown size={18} className="rotate-90" />
              </button>
            )}

            <img
              src={gallery[lightboxIndex]}
              alt={`Campsite view ${lightboxIndex + 1}`}
              className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl transition-all duration-300"
            />

            {gallery.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxIndex((prev) => (prev + 1) % gallery.length)}
                className="absolute right-2 sm:right-6 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 transition-all hover:scale-110 cursor-pointer shadow-xl"
                aria-label="Next photo"
              >
                <Icon.ArrowRight size={18} />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails */}
          {gallery.length > 1 && (
            <div className="flex items-center justify-center gap-2.5 overflow-x-auto py-2 z-10 max-w-2xl mx-auto scrollbar-none">
              {gallery.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  className={`w-14 h-11 sm:w-16 sm:h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    lightboxIndex === idx
                      ? 'border-secondary scale-105'
                      : 'border-white/20 opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

