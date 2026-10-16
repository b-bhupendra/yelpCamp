import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import Magnetic from '../components/Magnetic';
import Icon from '../components/Icons';
import { useAgentAction } from '../hooks/useAgentAction';

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

export default function NewCampground() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('45');
  const [locationAddress, setLocationAddress] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState(
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80'
  );
  const [galleryImages, setGalleryImages] = useState([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState(['tent_pitches', 'campfire']);
  const [rules, setRules] = useState({
    check_in: '14:00',
    check_out: '11:00',
    max_guests: 6,
    tent_capacity: 3,
    pets_allowed: true,
    campfires_allowed: true,
    quiet_hours: '22:00 - 07:00',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Register Agent Action for AI Assistant autofill
  useAgentAction({
    id: 'populate_campground_form',
    description: 'Auto-populates the new campsite creation form with provided parameters',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Name of the campsite' },
        price: { type: 'string', description: 'Price per night in USD' },
        location: { type: 'string', description: 'Location address or region' },
        description: { type: 'string', description: 'Terrain description' },
        amenities: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of amenities (e.g. campfire, wifi, potable_water)',
        },
      },
    },
    handler: (args) => {
      if (args.title) setTitle(args.title);
      if (args.price) setPrice(String(args.price));
      if (args.location) setLocationAddress(args.location);
      if (args.description) setDescription(args.description);
      if (args.amenities && Array.isArray(args.amenities)) {
        setSelectedAmenities(args.amenities);
      }
      return { status: 'populated', fields: args };
    },
  });

  const toggleAmenity = (id) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleAddGalleryImage = (customUrl) => {
    const url = (typeof customUrl === 'string' ? customUrl : newGalleryUrl).trim();
    if (!url) return;
    if (galleryImages.length >= 6) {
      toast.warning('Maximum 6 gallery photos allowed.');
      return;
    }
    setGalleryImages((prev) => [...prev, url]);
    if (!customUrl) setNewGalleryUrl('');
    setError('');
  };

  const handleRemoveGalleryImage = (index) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        title,
        price: parseFloat(price) || 0.0,
        image: coverImage,
        description,
        location: locationAddress,
        location_address: locationAddress,
        gallery_images: galleryImages,
        amenities: selectedAmenities,
        rules: rules,
      };

      const res = await api.post('/api/campgrounds', payload);
      toast.success('Wilderness sanctuary published!');
      const createdId = res.data?.id;
      if (createdId) {
        navigate(`/campgrounds/${createdId}`);
      } else {
        navigate('/campgrounds');
      }
    } catch (err) {
      console.error('Failed to create campsite:', err);
      const msg = err.response?.data?.detail ||
        err.response?.data?.error ||
        'Failed to create campsite. Ensure you are logged in.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full px-5 py-3.5 bg-surface border border-border rounded-2xl text-xs sm:text-sm text-fg focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all placeholder:text-fg-subtle';
  const labelClass =
    'block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2';

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
              <Icon.Compass size={13} /> Property Hosting Suite
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-black tracking-tight leading-tight text-fg">
              Publish a <span className="aurora-text">backcountry sanctuary.</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-fg-muted max-w-xl">
              Equip fellow adventurers with high-resolution photos, terrain rules, and verified amenity tags.
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
                  <label htmlFor="nc-title" className={labelClass}>
                    Campsite Name *
                  </label>
                  <input
                    id="nc-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={fieldClass}
                    placeholder="e.g. Celestial Pine Ridge"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="nc-price" className={labelClass}>
                    Price per Night ($ USD) *
                  </label>
                  <input
                    id="nc-price"
                    type="number"
                    min="0"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={fieldClass}
                    placeholder="45"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="nc-location" className={labelClass}>
                  Location Address & Region *
                </label>
                <input
                  id="nc-location"
                  type="text"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. North Cascade Pass, Washington, USA"
                  required
                />
              </div>

              <div>
                <label htmlFor="nc-desc" className={labelClass}>
                  Detailed Wilderness Description *
                </label>
                <textarea
                  id="nc-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className={`${fieldClass} resize-none`}
                  placeholder="Describe the terrain, elevation, stargazing quality, water source distance, and ideal season..."
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
                <label htmlFor="nc-cover" className={labelClass}>
                  Cover Photo URL *
                </label>
                <input
                  id="nc-cover"
                  type="url"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  className={fieldClass}
                  placeholder="https://..."
                  required
                />
              </div>

              {/* Cover Preview */}
              {coverImage && (
                <div className="relative rounded-2xl overflow-hidden aspect-[16/9] border border-border max-h-56 bg-surface-2">
                  <img
                    src={coverImage}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src =
                        'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80';
                    }}
                  />
                  <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/70 text-secondary text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                    Primary Cover
                  </span>
                </div>
              )}

              {/* Gallery Images Strip */}
              <div>
                <label className={labelClass}>
                  Gallery Images ({galleryImages.length} of 6)
                </label>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold text-fg-subtle">Quick presets:</span>
                  {PHOTO_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleAddGalleryImage(preset.url)}
                      disabled={galleryImages.length >= 6}
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
                    placeholder="Add gallery image URL (e.g. Unsplash or Cloudinary)..."
                    className="flex-1 min-h-[44px] px-4 py-2.5 bg-surface border border-border rounded-xl text-xs text-fg focus:outline-none focus:border-secondary"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddGalleryImage()}
                    disabled={galleryImages.length >= 6 || !newGalleryUrl.trim()}
                    className="cursor-pointer min-h-[44px] px-5 py-2.5 bg-secondary/15 hover:bg-secondary/25 border border-secondary/30 text-secondary font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40"
                  >
                    + Add Photo
                  </button>
                </div>

                {galleryImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {galleryImages.map((img, i) => (
                      <div
                        key={i}
                        className="relative rounded-xl overflow-hidden aspect-[4/3] border border-border/70 group bg-surface-2"
                      >
                        <img
                          src={img}
                          alt={`Gallery ${i + 1}`}
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
                {AVAILABLE_AMENITIES.map(({ id, label, icon: AmenityIcon }) => {
                  const selected = selectedAmenities.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleAmenity(id)}
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
                    value={rules.check_in}
                    onChange={(e) => setRules({ ...rules, check_in: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-fg focus:outline-none focus:border-secondary"
                    placeholder="14:00"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-subtle uppercase mb-1">
                    Check-out Time
                  </label>
                  <input
                    type="text"
                    value={rules.check_out}
                    onChange={(e) => setRules({ ...rules, check_out: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-fg focus:outline-none focus:border-secondary"
                    placeholder="11:00"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-subtle uppercase mb-1">
                    Max Campers
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={rules.max_guests}
                    onChange={(e) => setRules({ ...rules, max_guests: Number(e.target.value) })}
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
                    value={rules.tent_capacity}
                    onChange={(e) => setRules({ ...rules, tent_capacity: Number(e.target.value) })}
                    className="w-full min-h-[44px] px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-fg focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>

              {/* Rule Policy Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRules((r) => ({ ...r, pets_allowed: !r.pets_allowed }))}
                  className={`cursor-pointer flex items-center justify-between min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    rules.pets_allowed
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-surface border-border text-fg-subtle'
                  }`}
                >
                  <span>Pets Allowed</span>
                  <span className="text-[10px] uppercase font-bold">{rules.pets_allowed ? 'Yes' : 'No'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRules((r) => ({ ...r, campfires_allowed: !r.campfires_allowed }))}
                  className={`cursor-pointer flex items-center justify-between min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    rules.campfires_allowed
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-surface border-border text-fg-subtle'
                  }`}
                >
                  <span>Campfires Allowed</span>
                  <span className="text-[10px] uppercase font-bold">{rules.campfires_allowed ? 'Yes' : 'No'}</span>
                </button>

                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface border border-border min-h-[44px]">
                  <span className="text-[11px] text-fg-subtle font-medium shrink-0">Quiet:</span>
                  <input
                    type="text"
                    value={rules.quiet_hours}
                    onChange={(e) => setRules((r) => ({ ...r, quiet_hours: e.target.value }))}
                    className="w-full bg-transparent text-xs text-fg focus:outline-none"
                    placeholder="22:00 - 07:00"
                  />
                </div>
              </div>
            </div>

            {/* Submission Actions */}
            <div className="pt-4 border-t border-border/70 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/campgrounds')}
                className="px-5 py-3 rounded-full text-xs font-semibold text-fg-subtle hover:text-fg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <Magnetic strength={0.2}>
                <button
                  type="submit"
                  id="btn-publish-campground"
                  disabled={submitting}
                  className="cursor-pointer px-8 py-3.5 bg-primary hover:bg-secondary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.16em] transition-all duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Icon.Plus size={16} />
                      <span>Publish Property</span>
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
