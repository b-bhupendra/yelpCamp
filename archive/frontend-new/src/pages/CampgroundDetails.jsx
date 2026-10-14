import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import Magnetic from '../components/Magnetic';
import Icon from '../components/Icons';

export default function CampgroundDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campground, setCampground] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [social, setSocial] = useState({ likes: 0, dislikes: 0, user_vote: 0 });

  const fetchCampground = useCallback(async () => {
    try {
      const res = await api.get(`/index/${id}`);
      setCampground(res.data);
      const statsRes = await api.get(`/index/${id}/social/stats`);
      setSocial((prev) => ({ ...prev, ...statsRes.data }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCampground(); }, [fetchCampground]);

  const handleVote = async (type) => {
    if (!user) return navigate('/login');
    try {
      const res = await api.post(`/index/${id}/social/vote?vote_type=${type}`, {});
      setSocial({ likes: res.data.likes, dislikes: res.data.dislikes, user_vote: res.data.user_vote });
    } catch (err) { console.error(err); }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    try {
      await api.post(`/index/${id}/comments`, { text: comment });
      setComment('');
      fetchCampground();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this campsite? This cannot be undone.')) return;
    try {
      await api.post(`/index/${id}/delete`, {});
      navigate('/index');
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-border border-t-secondary rounded-full animate-spin" role="status" aria-label="Loading campsite" />
    </div>
  );
  if (!campground) return (
    <div className="min-h-screen bg-background pt-40 px-8 text-center">
      <p className="text-fg-subtle uppercase tracking-[0.24em] text-sm">Campsite not found</p>
    </div>
  );

  const likedBy = campground.liked_by || [];

  return (
    <div className="min-h-screen bg-background text-fg">
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <AmbientAtmosphere />
      </div>

      <div className="relative z-10 pt-36 md:pt-44 pb-20 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">

        {/* Left: visual content */}
        <div className="lg:col-span-7 space-y-8">
          <div className="relative rounded-2xl overflow-hidden aspect-[4/3] border border-border shadow-2xl">
            <img
              src={campground.image || "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=1200"}
              className="w-full h-full object-cover"
              alt={campground.name}
            />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
          </div>

          <div className="glass-obsidian rounded-2xl p-8 md:p-10 space-y-8 border border-border">
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-secondary uppercase mb-3">
                  <Icon.MapPin size={14} /> Campsite
                </p>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-none text-fg">{campground.name}</h1>
              </div>
              <div className="text-right">
                <p className="text-secondary font-bold text-3xl tracking-tight leading-none">
                  ${campground.price}
                  <span className="text-fg-subtle text-xs ml-1 font-normal uppercase tracking-wide">/night</span>
                </p>
              </div>
            </div>

            {/* Social bar */}
            <div className="flex flex-wrap gap-4 items-center py-5 border-y border-border">
              <button
                onClick={() => handleVote(1)}
                aria-pressed={social.user_vote === 1}
                className={`cursor-pointer inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border transition-colors duration-200 ${
                  social.user_vote === 1
                    ? 'bg-primary border-secondary text-on-primary'
                    : 'border-border hover:border-border-strong text-fg-muted hover:text-fg'
                }`}
              >
                <Icon.ArrowUp size={15} />
                <span className="text-xs font-semibold uppercase tracking-wide">{social.likes} likes</span>
              </button>
              <button
                onClick={() => handleVote(-1)}
                aria-pressed={social.user_vote === -1}
                className={`cursor-pointer inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border transition-colors duration-200 ${
                  social.user_vote === -1
                    ? 'bg-destructive/20 border-destructive/40 text-destructive'
                    : 'border-border hover:border-border-strong text-fg-muted hover:text-fg'
                }`}
              >
                <Icon.ArrowDown size={15} />
                <span className="text-xs font-semibold uppercase tracking-wide">{social.dislikes}</span>
              </button>

              <div className="ml-auto flex -space-x-2">
                {(likedBy.length > 0 ? likedBy : [101, 102, 103]).map((voter, i) => (
                  <div
                    key={voter.user_id || i}
                    className="w-9 h-9 rounded-full border-2 border-background bg-surface-2 overflow-hidden"
                    title={voter.username ? `@${voter.username}` : 'Explorer'}
                  >
                    <img
                      src={voter.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${voter.username || 'scout_' + i}`}
                      alt={voter.username ? `${voter.username} avatar` : 'Explorer avatar'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=scout_${i}`;
                      }}
                    />
                  </div>
                ))}
                {social.likes > likedBy.length && likedBy.length > 0 && (
                  <div className="w-9 h-9 rounded-full border-2 border-background bg-surface-2 flex items-center justify-center text-xs font-semibold text-fg-muted">
                    +{social.likes - likedBy.length}
                  </div>
                )}
              </div>
            </div>

            <p className="text-lg text-fg-muted leading-relaxed font-light">{campground.description}</p>

            <div className="pt-6 flex flex-wrap gap-4 justify-between items-center">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-sky-600 p-px overflow-hidden">
                  <img
                    src={campground.author_avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${campground.author_username || 'scout'}`}
                    alt={`${campground.author_username} avatar`}
                    className="w-full h-full object-cover rounded-xl"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${campground.author_username || 'scout'}`;
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-secondary uppercase leading-none mb-1">Posted by</p>
                  <p className="text-sm font-bold text-fg">{campground.author_username}</p>
                </div>
              </div>

              {user && user.id === campground.author_id && (
                <div className="flex gap-6">
                  <Link
                    to={`/campgrounds/${id}/edit`}
                    className="cursor-pointer inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg-muted hover:text-fg transition-colors"
                  >
                    <Icon.Compass size={14} /> Edit
                  </Link>
                  <button
                    onClick={handleDelete}
                    className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-destructive/80 hover:text-destructive transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: interaction */}
        <div className="lg:col-span-5 space-y-8">
          <div className="glass-obsidian-strong rounded-2xl p-8 md:p-10 border border-border relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 text-fg-faint/40" aria-hidden="true">
              <Icon.Quote size={34} />
            </div>
            <h2 className="text-2xl font-display font-black tracking-tight mb-8 leading-none text-fg">Reviews</h2>

            <form onSubmit={handleComment} className="mb-10 relative z-10">
              <label htmlFor="review" className="sr-only">Write a review</label>
              <textarea
                id="review"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share what you found here…"
                className="w-full px-6 py-5 bg-surface border border-border rounded-2xl text-sm text-fg focus:outline-none focus:border-secondary focus:ring-2 focus:ring-ring/30 transition-colors min-h-[130px] placeholder:text-fg-subtle"
                required
              />
              <div className="flex justify-end mt-4">
                <Magnetic strength={0.2}>
                  <button
                    type="submit"
                    className="cursor-pointer px-8 py-4 bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.16em] transition-transform duration-200 hover:scale-[1.04] active:scale-95"
                  >
                    Post review
                  </button>
                </Magnetic>
              </div>
            </form>

            <div className="space-y-5 max-h-[500px] overflow-y-auto pr-1">
              {campground.comments?.map((c) => (
                <div key={c.id} className="p-6 rounded-2xl bg-white/[0.02] border border-border hover:border-border-strong transition-colors">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/50 to-sky-600/40 p-px overflow-hidden">
                        <img
                          src={c.author_avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.author_username || 'scout'}`}
                          alt={`${c.author_username} avatar`}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.author_username || 'scout'}`;
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold tracking-wide text-secondary">@{c.author_username}</span>
                    </div>
                  </div>
                  <p className="text-sm text-fg-muted leading-relaxed">{c.text}</p>
                </div>
              ))}
              {campground.comments?.length === 0 && (
                <div className="text-center py-12 text-fg-subtle text-sm">No reviews yet — be the first.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
