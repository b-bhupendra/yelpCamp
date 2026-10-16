import React, { useState } from 'react';
import Icon from '../Icons';
import { useAuth } from '../../context/AuthContext';

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

function CommentItem({
  comment,
  depth = 0,
  onReplySubmit,
  canRate = false,
  highlightId,
}) {
  const { user } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const childReplies = comment.children || comment.replies || [];
  const hasChildren = childReplies.length > 0;
  const isHighlighted = highlightId && Number(highlightId) === Number(comment.id);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onReplySubmit({
        text: replyText.trim(),
        parentCommentId: comment.id,
      });
      setReplyText('');
      setIsReplying(false);
      setIsCollapsed(false); // Make sure children are visible to see reply
    } catch (err) {
      console.error('Failed to submit reply:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const avatarUrl =
    comment.author_avatar ||
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.author_username || 'scout_' + comment.id}`;

  return (
    <div
      id={`comment-node-${comment.id}`}
      className={`group/comment relative transition-all duration-300 ${
        isHighlighted ? 'ring-2 ring-secondary/50 rounded-2xl p-2 bg-secondary/5' : ''
      }`}
    >
      {/* Thread Content Card */}
      <div className="flex items-start gap-3.5">
        <div className="relative shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-border/80 bg-surface-2 shadow-sm group-hover/comment:border-secondary/40 transition-colors">
            <img
              src={avatarUrl}
              alt={comment.author_username || 'Scout'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=scout_${comment.id}`;
              }}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="rounded-2xl bg-surface/70 border border-border/60 hover:border-border-strong px-4 py-3 sm:px-5 sm:py-3.5 backdrop-blur-md transition-all duration-200">
            {/* Header info */}
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-xs sm:text-sm text-fg tracking-tight">
                  @{comment.author_username || 'explorer'}
                </span>
                {comment.rating ? (
                  <div
                    className="flex items-center gap-0.5 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 text-[10px] font-bold"
                    title={`Rating: ${comment.rating} / 5`}
                  >
                    <Icon.Star size={11} className="fill-amber-400 text-amber-400" />
                    <span>{comment.rating}</span>
                  </div>
                ) : null}
              </div>

              <span className="text-[11px] text-fg-subtle">
                {formatTimeAgo(comment.created_at)}
              </span>
            </div>

            {/* Comment Text */}
            <p className="text-xs sm:text-sm text-fg-muted leading-relaxed break-words whitespace-pre-wrap font-normal">
              {comment.text}
            </p>

            {/* Interaction Footer */}
            <div className="mt-2.5 pt-2 border-t border-border/30 flex items-center justify-between text-[11px]">
              <button
                type="button"
                id={`reply-btn-${comment.id}`}
                onClick={() => setIsReplying(!isReplying)}
                className="inline-flex items-center gap-1.5 text-fg-subtle hover:text-secondary font-semibold transition-colors cursor-pointer py-0.5"
              >
                <Icon.CornerDownRight size={13} />
                <span>{isReplying ? 'Cancel' : 'Reply'}</span>
              </button>

              {hasChildren && (
                <button
                  type="button"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="text-fg-subtle hover:text-fg text-[11px] font-medium transition-colors cursor-pointer"
                >
                  {isCollapsed
                    ? `Show ${childReplies.length} ${childReplies.length === 1 ? 'reply' : 'replies'}`
                    : 'Hide replies'}
                </button>
              )}
            </div>
          </div>

          {/* Inline Reply Form */}
          {isReplying && (
            <form
              onSubmit={handleReply}
              className="mt-3 relative pl-3 border-l-2 border-secondary/40 space-y-2 animate-fadeIn"
            >
              <div className="relative">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Replying to @${comment.author_username || 'explorer'}...`}
                  rows={2}
                  autoFocus
                  required
                  className="w-full px-4 py-2.5 bg-surface border border-secondary/30 rounded-xl text-xs sm:text-sm text-fg focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 placeholder:text-fg-subtle resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReplying(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-fg-subtle hover:text-fg hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !replyText.trim()}
                  className="px-4 py-1.5 rounded-lg bg-primary hover:bg-secondary text-on-primary text-xs font-semibold tracking-wide transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {submitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Post Reply</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Nested Children Thread */}
          {hasChildren && !isCollapsed && (
            <div className="mt-3.5 pl-3 sm:pl-4 border-l-2 border-sky-400/20 hover:border-sky-400/40 transition-colors space-y-3.5">
              {childReplies.map((child) => (
                <CommentItem
                  key={child.id}
                  comment={child}
                  depth={depth + 1}
                  onReplySubmit={onReplySubmit}
                  canRate={false}
                  highlightId={highlightId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ThreadedComments({
  comments = [],
  onSubmitComment,
  canRate = false,
  emptyMessage = 'No comments yet. Start the conversation!',
  highlightId = null,
  compact = false,
}) {
  const { user } = useAuth();
  const [rootText, setRootText] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleRootSubmit = async (e) => {
    e.preventDefault();
    if (!rootText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmitComment({
        text: rootText.trim(),
        rating: canRate ? rating : undefined,
        parentCommentId: null,
      });
      setRootText('');
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Root Composer Card */}
      <form
        onSubmit={handleRootSubmit}
        className="rounded-2xl bg-surface/80 border border-border/70 p-4 sm:p-5 backdrop-blur-xl relative shadow-lg"
      >
        {/* Rating selector if canRate is enabled */}
        {canRate && (
          <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-border/40">
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Your Trail Rating
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`Rate ${star} stars`}
                    className="p-1 cursor-pointer transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Icon.Star
                      size={18}
                      className={`transition-colors duration-150 ${
                        active
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-transparent text-border-strong hover:text-amber-400/60'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="relative">
          <textarea
            value={rootText}
            onChange={(e) => setRootText(e.target.value)}
            placeholder={
              canRate
                ? 'Share your experience, campsite conditions, or trail tips...'
                : 'Share your thoughts on this moment...'
            }
            rows={compact ? 2 : 3}
            required
            className="w-full px-4 py-3 bg-surface-2/60 border border-border rounded-xl text-xs sm:text-sm text-fg focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 placeholder:text-fg-subtle transition-all resize-none"
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-[11px] text-fg-subtle flex items-center gap-1.5">
            <Icon.Sparkles size={13} className="text-secondary" />
            <span>Threaded replies supported</span>
          </div>

          <button
            type="submit"
            disabled={submitting || !rootText.trim()}
            className="cursor-pointer px-5 py-2.5 bg-primary hover:bg-secondary text-on-primary rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-md shadow-primary/20 flex items-center gap-2"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>{canRate ? 'Post Review' : 'Comment'}</span>
            )}
          </button>
        </div>
      </form>

      {/* Discussion List */}
      <div className="space-y-4">
        {comments && comments.length > 0 ? (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onReplySubmit={onSubmitComment}
              canRate={canRate}
              highlightId={highlightId}
            />
          ))
        ) : (
          <div className="py-12 text-center rounded-2xl border border-dashed border-border/60 bg-surface/30 p-6">
            <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary mx-auto flex items-center justify-center mb-3">
              <Icon.MessageCircle size={20} />
            </div>
            <p className="text-xs sm:text-sm text-fg-subtle">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
