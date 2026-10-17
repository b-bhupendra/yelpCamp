import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api';
import { useToast } from '../context/ToastContext';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import Magnetic from '../components/Magnetic';
import Icon from '../components/Icons';
import { handleImageError } from '../utils/imageFallback';

const AVAILABLE_AMENITIES = [
  { id: 'tent_pitches', label: 'Tent Pitches', icon: Icon.Tent },
  { id: 'campfire', label: 'Campfire Allowed', icon: Icon.Flame },
  { id: 'hot_showers', label: 'Hot Showers', icon: Icon.Droplet },
  { id: 'potable_water', label: 'Potable Water', icon: Icon.Droplet },
  { id: 'wifi', label: 'WiFi Access', icon: Icon.Zap },
  { id: 'pet_friendly', label: 'Pet Friendly', icon: Icon.Users },
  { id: 'electricity', label: 'Solar / Grid Power', icon: Icon.Zap },
];

const PHOTO_PRESETS = [
  { label: 'Alpine Lake', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Starlight Camp', url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Forest Meadow', url: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80' },
];

export default function EditCampground() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    location_address: '',
    description: '',
    image: '',
    gallery_images: [],
    amenities: [],
    rules: {
      check_in: '14:00',
      check_out: '11:00',
      max_guests: 6,
      tent_capacity: 3,
      pets_allowed: true,
      campfires_allowed: true,
      quiet_hours: '22:00 - 07:00',
    },
  });
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCampground = async () => {
      try {
        const res = await api.get(`/api/campgrounds/${id}`);
        const data = res.data;
        const incomingRules = typeof data.rules === 'object' && data.rules !== null ? data.rules : {};
        setFormData({
          title: data.title || data.name || '',
          price: data.price ? String(data.price) : '50',
          location_address: data.location_address || data.location || '',
          description: data.description || '',
          image: data.image || '',
          gallery_images: Array.isArray(data.gallery_images) ? data.gallery_images : [],
          amenities: Array.isArray(data.amenities) ? data.amenities : [],
          rules: {
            check_in: incomingRules.check_in || '14:00',
            check_out: incomingRules.check_out || '11:00',
            max_guests: incomingRules.max_guests || 6,
            tent_capacity: incomingRules.tent_capacity || 3,
            pets_allowed: incomingRules.pets_allowed !== undefined ? incomingRules.pets_allowed : true,
            campfires_allowed: incomingRules.campfires_allowed !== undefined ? incomingRules.campfires_allowed : true,
            quiet_hours: incomingRules.quiet_hours || '22:00 - 07:00',
          },
        });
      } catch (err) {
        console.error(err);
        const msg = 'Failed to load campsite details, or you are not authorized to edit it.';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchCampground();
  }, [id, toast]);

  const toggleAmenity = (amenityId) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter((a) => a !== amenityId)
        : [...prev.amenities, amenityId],
    }));
  };

  const handleAddGalleryImage = (customUrl) => {
    const url = (typeof customUrl === 'string' ? customUrl : newGalleryUrl).trim();
    if (!url) return;
    if (formData.gallery_images.length >= 6) {
      toast.warning('Maximum 6 gallery photos allowed.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      gallery_images: [...prev.gallery_images, url],
    }));
    if (!customUrl) setNewGalleryUrl('');
    setError('');
  };

  const handleRemoveGalleryImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      gallery_images: prev.gallery_images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        title: formData.title,
        price: parseFloat(formData.price) || 0.0,
        image: formData.image,
        description: formData.description,
        location: formData.location_address,
        location_address: formData.location_address,
        gallery_images: formData.gallery_images,
        amenities: formData.amenities,
        rules: formData.rules,
      };

      await api.put(`/api/campgrounds/${id}`, payload);
      toast.success('Campsite details updated successfully.');
      navigate(`/campgrounds/${id}`);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to update campsite.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'w-full px-5 py-3.5 bg-surface border border-border rounded-2xl text-xs sm:text-sm text-fg focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all placeholder:text-fg-subtle';
  const labelClass =
    'block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          className="w-12 h-12 border-2 border-border border-t-secondary rounded-full animate-spin"
          role="status"
          aria-label="Loading campsite"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-background selection:bg-secondary/30">
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <AmbientAtmosphere />
      </div>

      <div className="relative z-10 pt-32 sm:pt-40 pb-24 px-4 sm:px-6 md:px-12 flex justify-center">
        <div className="w-full max-w-3xl animate-mask-up">
          {/* Header */}
          <div className="mb-10 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full border border-sky-400/20 bg-surface/80 text-[11px] font-bold uppercase tracking-widest text-secondary">
              <Icon.Compass size={13} /> Edit Property
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-black tracking-tight leading-tight text-fg">
              Refine your <span className="aurora-text">listing.</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-fg-muted max-w-xl">
              Keep trail descriptions, gallery photos, and terrain rules current for visitors.
            </p>
          </div>

          {error && (
            <div
              className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm rounded-2xl flex items-center gap-2"
              role="alert"
            >
              <Icon.Close size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8 glass-obsidian rounded-3xl p-6 sm:p-10 border border-border/80 shadow-2xl">
            {/* 1. Basic Details */}
            <div className="space-y-5">
              <h2 className="font-display font-bold text-sm uppercase tracking-wider text-secondary flex items-center gap-2 pb-2 border-b border-border/60">
                <span>01</span> Basic Property Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="ec-title" className={labelClass}>
                    Campsite Name *
                  </label>
                  <input
                    id="ec-title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={fieldClass}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="ec-price" className={labelClass}>
                    Price per Night ($ USD) *
                  </label>
                  <input
                    id="ec-price"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className={fieldClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ec-location" className={labelClass}>
                  Location Address & Region *
                </label>
                <input
                  id="ec-location"
                  type="text"
                  value={formData.location_address}
                  onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                  className={fieldClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="ec-desc" className={labelClass}>
                  Detailed Wilderness Description *
                </label>
                <textarea
                  id="ec-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className={`${fieldClass} resize-none`}
                  required
                />
              </div>
            </div>

            {/* 2. Visual Media & Gallery */}
            <div className="space-y-5">
              <h2 className="font-display font-bold text-sm uppercase tracking-wider text-secondary flex items-center gap-2 pb-2 border-b border-border/60">
                <span>02</span> High-Resolution Photography
              </h2>

              <div>
                <label htmlFor="ec-cover" className={labelClass}>
                  Cover Photo URL *
                </label>
                <input
                  id="ec-cover"
                  type="url"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className={fieldClass}
                  required
                />
              </div>

              {/* Cover Preview */}
              {formData.image && (
                <div className="relative rounded-2xl overflow-hidden aspect-[16/9] border border-border max-h-56 bg-surface-2">
                  <img
                    src={formData.image}
                    alt="Cover preview"
                    onError={(e) => handleImageError(e, 'campground', 'cover_preview')}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/70 text-secondary text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                    Primary Cover
                  </span>
                </div>
              )}

              {/* Gallery Images Strip */}
              <div>
                <label className={labelClass}>
                  Gallery Images ({formData.gallery_images.length} of 6)
                </label>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold text-fg-subtle">Quick presets:</span>
                  {PHOTO_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleAddGalleryImage(preset.url)}
                      disabled={formData.gallery_images.length >= 6}
                      className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border/80 text-[11px] font-medium text-fg-muted hover:text-secondary hover:border-secondary/50 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 mb-3">
                  <input
                    type="url"
                    value={newGalleryUrl}
                    onChange={(e) => setNewGalleryUrl(e.target.value)}
                    placeholder="Add gallery photo URL..."
                    className="flex-1 min-h-[44px] px-4 py-2.5 bg-surface border border-border rounded-xl text-xs text-fg focus:outline-none focus:border-secondary"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddGalleryImage()}
                    disabled={formData.gallery_images.length >= 6 || !newGalleryUrl.trim()}
                    className="cursor-pointer min-h-[44px] px-5 py-2.5 bg-secondary/15 hover:bg-secondary/25 border border-secondary/30 text-secondary font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40"
                  >
                    + Add Photo
                  </button>
                </div>

                {formData.gallery_images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {formData.gallery_images.map((img, i) => (
                      <div
                        key={i}
                        className="relative rounded-xl overflow-hidden aspect-[4/3] border border-border/70 group bg-surface-2"
                      >
                        <img
                          src={img}
                          alt={`Gallery ${i + 1}`}
                          onError={(e) => handleImageError(e, 'campground', i)}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryImage(i)}
                          className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-full bg-black/80 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow-lg"
                          title="Remove photo"
                          aria-label={`Remove photo ${i + 1}`}
                        >
                          <Icon.Close size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Amenities */}
            <div className="space-y-4">
              <h2 className="font-display font-bold text-sm uppercase tracking-wider text-secondary flex items-center gap-2 pb-2 border-b border-border/60">
                <span>03</span> Verified Amenities
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {AVAILABLE_AMENITIES.map(({ id: amenId, label, icon: AmenityIcon }) => {
                  const selected = formData.amenities.includes(amenId);
                  return (
                    <button
                      key={amenId}
                      type="button"
                      onClick={() => toggleAmenity(amenId)}
                      className={`cursor-pointer flex items-center gap-2.5 min-h-[48px] p-3.5 rounded-2xl border text-left transition-all duration-200 ${
                        selected
                          ? 'bg-secondary/15 border-secondary/60 text-fg ring-1 ring-secondary/40 shadow-md shadow-secondary/10'
                          : 'bg-surface-2/40 border-border/60 text-fg-muted hover:border-border-strong hover:text-fg'
                      }`}
                    >
                      <AmenityIcon
                        size={17}
                        className={selected ? 'text-secondary' : 'text-fg-subtle'}
                      />
                      <span className="text-xs font-semibold tracking-tight">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Terrain Rules & Capacity */}
            <div className="space-y-5">
              <h2 className="font-display font-bold text-sm uppercase tracking-wider text-secondary flex items-center gap-2 pb-2 border-b border-border/60">
                <span>04</span> Terrain Rules & Capacity
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-fg-subtle uppercase mb-1">
                    Check-in Time
                  </label>
                  <input
                    type="text"
                    value={formData.rules.check_in || '14:00'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rules: { ...formData.rules, check_in: e.target.value },
                      })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-fg focus:outline-none focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-subtle uppercase mb-1">
                    Check-out Time
                  </label>
                  <input
                    type="text"
                    value={formData.rules.check_out || '11:00'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rules: { ...formData.rules, check_out: e.target.value },
                      })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-fg focus:outline-none focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-subtle uppercase mb-1">
                    Max Campers
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.rules.max_guests || 6}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rules: { ...formData.rules, max_guests: Number(e.target.value) },
                      })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-fg focus:outline-none focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-subtle uppercase mb-1">
                    Tent Pitches
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.rules.tent_capacity || 3}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rules: { ...formData.rules, tent_capacity: Number(e.target.value) },
                      })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-fg focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>

              {/* Rule Policy Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      rules: { ...formData.rules, pets_allowed: !formData.rules.pets_allowed },
                    })
                  }
                  className={`cursor-pointer flex items-center justify-between min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    formData.rules.pets_allowed
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-surface border-border text-fg-subtle'
                  }`}
                >
                  <span>Pets Allowed</span>
                  <span className="text-[10px] uppercase font-bold">{formData.rules.pets_allowed ? 'Yes' : 'No'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      rules: { ...formData.rules, campfires_allowed: !formData.rules.campfires_allowed },
                    })
                  }
                  className={`cursor-pointer flex items-center justify-between min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    formData.rules.campfires_allowed
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-surface border-border text-fg-subtle'
                  }`}
                >
                  <span>Campfires Allowed</span>
                  <span className="text-[10px] uppercase font-bold">{formData.rules.campfires_allowed ? 'Yes' : 'No'}</span>
                </button>

                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface border border-border min-h-[44px]">
                  <span className="text-[11px] text-fg-subtle font-medium shrink-0">Quiet:</span>
                  <input
                    type="text"
                    value={formData.rules.quiet_hours || '22:00 - 07:00'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rules: { ...formData.rules, quiet_hours: e.target.value },
                      })
                    }
                    className="w-full bg-transparent text-xs text-fg focus:outline-none"
                    placeholder="22:00 - 07:00"
                  />
                </div>
              </div>
            </div>

            {/* Submission Actions */}
            <div className="pt-4 border-t border-border/70 flex items-center justify-between">
              <Link
                to={`/campgrounds/${id}`}
                className="px-5 py-3 rounded-full text-xs font-semibold text-fg-subtle hover:text-fg transition-colors"
              >
                Cancel
              </Link>

              <Magnetic strength={0.2}>
                <button
                  type="submit"
                  disabled={saving}
                  className="cursor-pointer px-8 py-3.5 bg-primary hover:bg-secondary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.16em] transition-all duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Icon.Check size={16} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </Magnetic>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
