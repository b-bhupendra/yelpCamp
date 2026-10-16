import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Icon from '../Icons';
import ThreadedComments from '../comments/ThreadedComments';

const SLIDE_DURATION = 5000; // 5 seconds per slide per roadmap

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'recently';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(Number(timestamp) * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function StoryViewerModal({
  isOpen,
  onClose,
  storyGroups = [],
  initialGroupIndex = 0,
  onStoryDeleted,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isPaused, setIsPaused] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [likeState, setLikeState] = useState({ liked: false, count: 0 });

  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedTimeRef = useRef(0);

  // Sync initial group
  useEffect(() => {
    if (isOpen) {
      setGroupIndex(Math.min(initialGroupIndex, Math.max(0, storyGroups.length - 1)));
      setPhotoIndex(0);
      setProgress(0);
      setIsCommentsOpen(false);
    }
  }, [isOpen, initialGroupIndex, storyGroups.length]);

  const currentGroup = storyGroups[groupIndex] || null;
  const currentPhoto = currentGroup?.photos?.[photoIndex] || null;

  // Sync like state when current photo changes
  useEffect(() => {
    if (currentPhoto) {
      setLikeState({
        liked: Boolean(currentPhoto.liked_by_me),
        count: Number(currentPhoto.likes_count || 0),
      });

      // Mark photo as viewed in localStorage
      try {
        const viewed = JSON.parse(localStorage.getItem('yelpcamp_viewed_stories') || '[]');
        if (!viewed.includes(currentPhoto.id)) {
          viewed.push(currentPhoto.id);
          localStorage.setItem('yelpcamp_viewed_stories', JSON.stringify(viewed));
        }
      } catch (e) {
        // ignore localStorage error
      }
    }
  }, [currentPhoto]);

  // Fetch comments when comments drawer is opened or photo changes while open
  const fetchComments = useCallback(async () => {
    if (!currentPhoto?.id) return;
    setCommentsLoading(true);
    try {
      const res = await api.get(`/api/stories/${currentPhoto.id}/comments`);
      const commentList = Array.isArray(res.data) ? res.data : (res.data.comments || []);
      setComments(commentList);
    } catch (err) {
      console.error('Failed to load story comments:', err);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [currentPhoto?.id]);

  useEffect(() => {
    if (isCommentsOpen && currentPhoto?.id) {
      fetchComments();
    }
  }, [isCommentsOpen, currentPhoto?.id, fetchComments]);

  // Slide advancement helpers
  const goToNext = useCallback(() => {
    if (!currentGroup) return;
    if (photoIndex < currentGroup.photos.length - 1) {
      setPhotoIndex((prev) => prev + 1);
      setProgress(0);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setPhotoIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentGroup, photoIndex, groupIndex, storyGroups.length, onClose]);

  const goToPrev = useCallback(() => {
    if (photoIndex > 0) {
      setPhotoIndex((prev) => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      const prevGroup = storyGroups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setPhotoIndex(Math.max(0, (prevGroup?.photos?.length || 1) - 1));
      setProgress(0);
    }
  }, [photoIndex, groupIndex, storyGroups]);

  // 5-second progress timer via requestAnimationFrame
  useEffect(() => {
    if (!isOpen || !currentPhoto || isPaused || isCommentsOpen) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    startTimeRef.current = performance.now() - (pausedTimeRef.current || 0);

    const step = (now) => {
      const elapsed = now - startTimeRef.current;
      const currentPct = Math.min(100, (elapsed / SLIDE_DURATION) * 100);
      setProgress(currentPct);

      if (elapsed >= SLIDE_DURATION) {
        pausedTimeRef.current = 0;
        goToNext();
      } else {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, currentPhoto, isPaused, isCommentsOpen, goToNext, photoIndex, groupIndex]);

  // Reset paused timer when slide advances
  useEffect(() => {
    pausedTimeRef.current = 0;
    setProgress(0);
  }, [photoIndex, groupIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isCommentsOpen) setIsCommentsOpen(false);
        else onClose();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCommentsOpen, goToNext, goToPrev, onClose]);

  // Like Toggle
  const handleLike = async () => {
    if (!currentPhoto?.id) return;
    const previousState = { ...likeState };
    // Optimistic update
    setLikeState((prev) => ({
      liked: !prev.liked,
      count: prev.liked ? Math.max(0, prev.count - 1) : prev.count + 1,
    }));

    try {
      const res = await api.post(`/api/stories/${currentPhoto.id}/like`);
      setLikeState({
        liked: res.data.liked,
        count: res.data.likes_count,
      });
    } catch (err) {
      console.error('Like toggle failed:', err);
      setLikeState(previousState);
    }
  };

  // Submit comment on story
  const handleStoryCommentSubmit = async ({ text, parentCommentId }) => {
    if (!currentPhoto?.id) return;
    try {
      await api.post(`/api/stories/${currentPhoto.id}/comments`, {
        text,
        parent_comment_id: parentCommentId,
      });
      toast.success(parentCommentId ? 'Reply submitted.' : 'Comment posted on moment.');
      fetchComments();
    } catch (err) {
      console.error('Failed to post story comment:', err);
      toast.error('Could not post comment. Please try again.');
    }
  };

  // Delete story
  const handleDeletePhoto = async () => {
    if (!currentPhoto?.id) return;
    if (!window.confirm('Delete this visitor moment permanently?')) return;
    try {
      await api.delete(`/api/stories/${currentPhoto.id}`);
      toast.success('Field moment deleted.');
      if (onStoryDeleted) onStoryDeleted(currentPhoto.id);
      goToNext();
    } catch (err) {
      console.error('Failed to delete story:', err);
      toast.error('Failed to delete moment.');
    }
  };

  // Share story
  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: currentPhoto?.caption || 'YelpCamp Trail Moment',
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.info('Link copied to clipboard.');
    }
  };

  if (!isOpen || !currentGroup || !currentPhoto) return null;

  const isAuthor = user && (user.id === currentPhoto.user_id || user.username === currentGroup.username);
  const aiTags = currentPhoto.ai_tags || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-0 sm:p-4 select-none animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Story Viewer"
    >
      {/* Container Frame */}
      <div className="relative w-full max-w-md h-full sm:h-[90vh] sm:max-h-[820px] sm:rounded-3xl overflow-hidden bg-black border sm:border-white/10 shadow-2xl flex flex-col justify-between">
        {/* Background Blurred Glow */}
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 scale-125 pointer-events-none"
          style={{ backgroundImage: `url(${currentPhoto.image_url})` }}
        />

        {/* TOP OVERLAY: Progress bars & Header */}
        <div className="relative z-30 pt-3.5 px-3.5 pb-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {/* Segmented Progress Bars */}
          <div className="flex items-center gap-1.5 mb-3">
            {currentGroup.photos.map((p, idx) => {
              let fillWidth = '0%';
              if (idx < photoIndex) fillWidth = '100%';
              else if (idx === photoIndex) fillWidth = `${progress}%`;

              return (
                <div
                  key={p.id || idx}
                  className="flex-1 h-1 sm:h-1.5 rounded-full bg-white/20 overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-all duration-75 ease-linear"
                    style={{ width: fillWidth }}
                  />
                </div>
              );
            })}
          </div>

          {/* User Details & Controls Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-secondary/60 shrink-0 bg-surface">
                <img
                  src={
                    currentGroup.avatar_url ||
                    `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentGroup.username}`
                  }
                  alt={currentGroup.username}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-xs sm:text-sm text-white truncate">
                    @{currentGroup.username}
                  </span>
                  <span className="text-[11px] text-white/60 shrink-0">
                    {formatTimeAgo(currentPhoto.created_at)}
                  </span>
                </div>
                {currentPhoto.campground_title && (
                  <Link
                    to={`/campgrounds/${currentPhoto.campground_id}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-[11px] text-secondary hover:text-white transition-colors truncate"
                  >
                    <Icon.MapPin size={11} />
                    <span className="truncate">{currentPhoto.campground_title}</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Top Action Icons */}
            <div className="flex items-center gap-1.5">
              {/* Play/Pause Toggle */}
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                aria-label={isPaused ? 'Resume story' : 'Pause story'}
                className="w-11 h-11 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/10"
              >
                {isPaused ? <Icon.Play size={18} /> : <Icon.Pause size={18} />}
              </button>

              {/* Author Delete */}
              {isAuthor && (
                <button
                  type="button"
                  id="btn-delete-moment"
                  onClick={handleDeletePhoto}
                  aria-label="Delete this moment"
                  title="Delete moment"
                  className="w-11 h-11 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors cursor-pointer rounded-full hover:bg-red-500/10"
                >
                  <Icon.Trash2 size={18} />
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close story viewer"
                className="w-11 h-11 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/10"
              >
                <Icon.Close size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* Hold-to-pause visual indicator */}
        {isPaused && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-black/80 border border-white/20 backdrop-blur-md flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wider pointer-events-none animate-fadeIn shadow-2xl">
            <Icon.Pause size={13} />
            <span>Story Paused</span>
          </div>
        )}

        {/* MAIN PHOTO DISPLAY */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          <img
            src={currentPhoto.image_url}
            alt={currentPhoto.caption || 'Camper moment'}
            className="w-full h-full object-cover sm:object-contain select-none"
            draggable={false}
          />

          {/* TAP NAVIGATION ZONES (Left 30% Prev, Right 70% Next) */}
          <div
            className="absolute inset-y-0 left-0 w-[30%] z-20 cursor-pointer"
            onClick={goToPrev}
            onPointerDown={() => setIsPaused(true)}
            onPointerUp={() => setIsPaused(false)}
            onPointerLeave={() => setIsPaused(false)}
            aria-label="Previous photo"
          />
          <div
            className="absolute inset-y-0 right-0 w-[70%] z-20 cursor-pointer"
            onClick={goToNext}
            onPointerDown={() => setIsPaused(true)}
            onPointerUp={() => setIsPaused(false)}
            onPointerLeave={() => setIsPaused(false)}
            aria-label="Next photo"
          />
        </div>

        {/* BOTTOM OVERLAY: Caption, AI Tags & Actions */}
        <div className="relative z-30 p-4 bg-gradient-to-t from-black via-black/80 to-transparent space-y-3">
          {/* AI Scenery Badges */}
          {aiTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {aiTags.slice(0, 4).map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-medium text-sky-300 backdrop-blur-md"
                >
                  <Icon.Sparkles size={10} className="text-secondary" />
                  <span>#{tag.replace(/\s+/g, '')}</span>
                </span>
              ))}
            </div>
          )}

          {/* Caption */}
          {currentPhoto.caption && (
            <p className="text-xs sm:text-sm text-white/95 leading-relaxed font-normal drop-shadow-sm">
              {currentPhoto.caption}
            </p>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              {/* Like Button */}
              <button
                type="button"
                id="btn-like-story"
                onClick={handleLike}
                aria-label={likeState.liked ? 'Unlike story' : 'Like story'}
                className="cursor-pointer inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all duration-200 active:scale-95 backdrop-blur-md"
              >
                <Icon.Heart
                  size={16}
                  className={`transition-colors ${
                    likeState.liked
                      ? 'fill-rose-500 text-rose-500 scale-110'
                      : 'text-white'
                  }`}
                />
                <span className="text-xs font-semibold">{likeState.count}</span>
              </button>

              {/* Threaded Comment Drawer Toggle */}
              <button
                type="button"
                id="btn-story-comments"
                onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                aria-label="View or post replies on this moment"
                className="cursor-pointer inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all duration-200 active:scale-95 backdrop-blur-md"
              >
                <Icon.MessageCircle size={16} />
                <span className="text-xs font-semibold">Replies</span>
              </button>
            </div>

            {/* Share Button */}
            <div className="relative">
              <button
                type="button"
                onClick={handleShare}
                aria-label="Share moment"
                className="cursor-pointer w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all duration-200 active:scale-95 backdrop-blur-md"
              >
                <Icon.Share2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* SLIDE-UP THREADED COMMENTS DRAWER */}
        {isCommentsOpen && (
          <div className="absolute inset-x-0 bottom-0 top-16 z-40 bg-ink-950/95 border-t border-border-strong backdrop-blur-2xl rounded-t-3xl flex flex-col overflow-hidden animate-slideUp shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2">
                <Icon.MessageCircle size={18} className="text-secondary" />
                <h3 className="font-display font-bold text-sm text-fg">
                  Moment Discussion
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCommentsOpen(false)}
                className="w-11 h-11 flex items-center justify-center text-fg-subtle hover:text-fg rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
                aria-label="Close comments drawer"
              >
                <Icon.Close size={18} />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {commentsLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
                </div>
              ) : (
                <ThreadedComments
                  comments={comments}
                  onSubmitComment={handleStoryCommentSubmit}
                  canRate={false}
                  compact={true}
                  emptyMessage="No comments yet. Be the first to reply to this camper moment!"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
