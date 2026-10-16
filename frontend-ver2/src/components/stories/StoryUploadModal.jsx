import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Icon from '../Icons';
import { useAgentAction } from '../../hooks/useAgentAction';

export default function StoryUploadModal({
  isOpen,
  onClose,
  campgroundId = null,
  campgroundTitle = '',
  onSuccess,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [selectedCampId, setSelectedCampId] = useState(campgroundId || '');
  const [campgrounds, setCampgrounds] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  // Sync campgroundId if passed as prop
  useEffect(() => {
    if (campgroundId) {
      setSelectedCampId(campgroundId);
    }
  }, [campgroundId]);

  // Fetch campsites list if opened globally without pre-selected campground
  useEffect(() => {
    if (isOpen && !campgroundId) {
      api.get('/api/campgrounds')
        .then((res) => {
          const camps = res.data.items || res.data.campgrounds || (Array.isArray(res.data) ? res.data : []);
          setCampgrounds(camps);
          if (camps.length > 0 && !selectedCampId) {
            setSelectedCampId(camps[0].id);
          }
        })
        .catch((err) => console.error('Failed to load campgrounds list:', err));
    }
  }, [isOpen, campgroundId, selectedCampId]);

  // Clean preview URL when file changes
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // Register agent action for AI co-pilot
  useAgentAction({
    id: 'submit_campsite_story',
    description: 'Fills or prepares a visitor photo moment for upload',
    parameters: {
      type: 'object',
      properties: {
        caption: { type: 'string', description: 'Caption for the moment' },
      },
    },
    handler: ({ caption: newCaption }) => {
      if (newCaption) setCaption(newCaption);
      return { status: 'prepared', caption: newCaption };
    },
  });

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setUploadError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile);
      setUploadError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select a photo to share.');
      return;
    }
    const targetCampId = campgroundId || selectedCampId;
    if (!targetCampId) {
      setUploadError('Please select a campsite for this moment.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('caption', caption);
    formData.append('is_story', 'true');
    // Note: Per user directive, expires_hours is omitted so expires_at = None (permanent until user deletes)

    try {
      const res = await api.post(`/api/campgrounds/${targetCampId}/stories`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Reset and close
      setFile(null);
      setCaption('');
      toast.success('Visitor moment published!');
      if (onSuccess) onSuccess(res.data.photo);
      onClose();
    } catch (err) {
      console.error('Photo upload failed:', err);
      const msg = err.response?.data?.detail || 'Failed to upload photo moment. Please try again.';
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div className="relative w-full max-w-lg bg-surface border border-border-strong rounded-3xl shadow-2xl overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/70 bg-surface-2/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-secondary/15 text-secondary flex items-center justify-center">
              <Icon.Camera size={18} />
            </div>
            <div>
              <h2 id="upload-modal-title" className="font-display font-bold text-base text-fg">
                Share a Backcountry Moment
              </h2>
              <p className="text-[11px] text-fg-subtle">
                Post visitor photos with AI scenic tags
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-11 h-11 flex items-center justify-center text-fg-subtle hover:text-fg rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <Icon.Close size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Campsite selector if global */}
          {!campgroundId && (
            <div>
              <label htmlFor="camp-select" className="block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">
                Campsite Location
              </label>
              <select
                id="camp-select"
                value={selectedCampId}
                onChange={(e) => setSelectedCampId(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-xs sm:text-sm text-fg focus:outline-none focus:border-secondary transition-colors"
              >
                {campgrounds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {campgroundId && campgroundTitle && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/10 border border-secondary/20 text-xs font-medium text-secondary">
              <Icon.MapPin size={13} />
              <span>{campgroundTitle}</span>
            </div>
          )}

          {/* Media Dropzone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">
              Photo
            </label>
            {previewUrl ? (
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] border border-border group">
                <img
                  src={previewUrl}
                  alt="Upload preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/70 hover:bg-black text-white transition-colors cursor-pointer"
                  title="Remove photo"
                >
                  <Icon.Close size={16} />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-secondary/60 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-surface-2/30 hover:bg-surface-2/50 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center mx-auto mb-3 text-fg-subtle group-hover:text-secondary group-hover:border-secondary/40 transition-colors">
                  <Icon.Image size={24} />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-fg mb-1">
                  Click or drag photo here
                </p>
                <p className="text-[11px] text-fg-subtle">
                  Supports JPEG, PNG, WebP up to 10MB
                </p>
              </div>
            )}
          </div>

          {/* Caption */}
          <div>
            <label htmlFor="caption" className="block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">
              Caption
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What made this moment memorable? (e.g., Sunset over the ridge, crystal clear night sky...)"
              rows={3}
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-xs sm:text-sm text-fg focus:outline-none focus:border-secondary transition-colors placeholder:text-fg-subtle resize-none"
            />
          </div>

          {/* Permanent Availability Notice (User Directive) */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            <Icon.Check size={16} className="shrink-0 mt-0.5" />
            <span>
              <strong>Permanent Moment:</strong> This story will remain visible on YelpCamp until you choose to delete it.
            </span>
          </div>

          {uploadError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {uploadError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="min-h-[44px] px-6 py-2.5 rounded-xl border border-border hover:border-border-strong text-xs font-semibold text-fg-muted hover:text-fg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-confirm-upload-story"
              disabled={isUploading || !file}
              className="cursor-pointer min-h-[44px] px-7 py-2.5 bg-primary hover:bg-secondary text-on-primary rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  <span>Processing AI Tags...</span>
                </>
              ) : (
                <>
                  <Icon.Sparkles size={14} />
                  <span>Post Moment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
