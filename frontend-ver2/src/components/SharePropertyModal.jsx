import React, { useState } from 'react';
import Icon from './Icons';
import { useAgentAction } from '../hooks/useAgentAction';

export default function SharePropertyModal({
  isOpen,
  onClose,
  campground = null,
}) {
  const [copied, setCopied] = useState(false);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  // Register agent action
  useAgentAction({
    id: 'open_share_modal',
    description: 'Opens the share suite for this campsite',
    parameters: { type: 'object', properties: {} },
    handler: () => {
      return { status: 'opened', modal: 'SharePropertyModal' };
    },
  });

  if (!isOpen || !campground) return null;

  const campTitle = campground.title || campground.name || 'Wilderness Campsite';
  const campPrice = campground.price ? `$${campground.price}/night` : '';
  const campRating = campground.avg_rating || 5.0;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const shareText = encodeURIComponent(`Check out ${campTitle} on YelpCamp: ${currentUrl}`);

  const shareLinks = [
    {
      name: 'WhatsApp',
      url: `https://api.whatsapp.com/send?text=${shareText}`,
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30',
    },
    {
      name: 'X (Twitter)',
      url: `https://twitter.com/intent/tweet?text=${shareText}`,
      color: 'bg-sky-500/20 text-sky-400 border-sky-500/30 hover:bg-sky-500/30',
    },
    {
      name: 'Telegram',
      url: `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(campTitle)}`,
      color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30',
    },
    {
      name: 'Facebook',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`,
      color: 'bg-blue-600/20 text-blue-400 border-blue-600/30 hover:bg-blue-600/30',
    },
  ];

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&format=png&data=${encodeURIComponent(
    currentUrl
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="relative w-full max-w-md bg-surface border border-border-strong rounded-3xl shadow-2xl overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/70 bg-surface-2/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-secondary/15 text-secondary flex items-center justify-center">
              <Icon.Share2 size={17} />
            </div>
            <div>
              <h2 id="share-modal-title" className="font-display font-bold text-base text-fg">
                Share Campsite
              </h2>
              <p className="text-[11px] text-fg-subtle">
                Send to fellow scouts or download offline QR
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-fg-subtle hover:text-fg rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <Icon.Close size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Campsite Preview Card */}
          <div className="rounded-2xl bg-surface-2/60 border border-border/60 p-3.5 flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-border/80">
              <img
                src={campground.image || "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=300"}
                alt={campTitle}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-bold text-sm text-fg truncate">
                {campTitle}
              </h3>
              <p className="text-xs text-secondary font-semibold mt-0.5">
                {campPrice}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-400">
                <Icon.Star size={11} className="fill-amber-400" />
                <span>{campRating} Rating</span>
              </div>
            </div>
          </div>

          {/* Copy Link Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">
              Direct Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 px-3.5 py-2.5 bg-surface-2 border border-border rounded-xl text-xs text-fg-muted truncate focus:outline-none"
              />
              <button
                type="button"
                id="btn-copy-link"
                onClick={handleCopyLink}
                className={`cursor-pointer px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shrink-0 flex items-center gap-1.5 ${
                  copied
                    ? 'bg-emerald-500 text-black'
                    : 'bg-primary hover:bg-secondary text-on-primary shadow-md shadow-primary/20'
                }`}
              >
                {copied ? (
                  <>
                    <Icon.Check size={14} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <span>Copy</span>
                )}
              </button>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2.5">
              Share to Apps
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {shareLinks.map((item) => (
                <a
                  key={item.name}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all duration-200 ${item.color}`}
                >
                  <span>{item.name}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Offline QR Code */}
          <div className="pt-2 border-t border-border/50 text-center">
            <span className="block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
              Offline Trail QR Code
            </span>
            <div className="w-36 h-36 mx-auto rounded-2xl bg-white p-2.5 shadow-md border border-border flex items-center justify-center mb-3">
              <img
                src={qrImageUrl}
                alt="Campground QR Code"
                className="w-full h-full object-contain"
              />
            </div>
            <a
              href={qrImageUrl}
              download={`${campTitle.replace(/\s+/g, '_')}_QR.png`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-white transition-colors"
            >
              <Icon.ArrowDown size={13} />
              <span>Download Offline QR</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
