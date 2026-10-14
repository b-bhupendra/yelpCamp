import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import Magnetic from '../components/Magnetic';

export default function NewCampground() {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/index/', {
        name: title,
        image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80",
        price: price || "50",
        description,
      });
      navigate('/index');
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to create campsite. Ensure you are logged in.');
    }
  };

  const fieldClass = "w-full px-6 py-4 bg-surface border border-border rounded-2xl text-sm text-fg focus:outline-none focus:border-secondary focus:ring-2 focus:ring-ring/30 transition-colors placeholder:text-fg-subtle";
  const labelClass = "text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted ml-1";

  return (
    <div className="min-h-screen relative bg-background selection:bg-secondary/30">
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <AmbientAtmosphere />
      </div>

      <div className="relative z-10 pt-36 md:pt-44 pb-20 px-6 flex justify-center">
        <div className="w-full max-w-2xl animate-mask-up">

          <div className="mb-12">
            <p className="text-xs font-semibold tracking-[0.3em] text-secondary uppercase mb-4">Add a campsite</p>
            <h1 className="text-4xl md:text-6xl font-display font-black tracking-tight leading-[0.95] text-fg">
              Share a <br /> <span className="aurora-text">hidden spot.</span>
            </h1>
          </div>

          {error && (
            <div className="mb-8 p-5 glass-obsidian border-destructive/30 text-destructive text-sm rounded-2xl" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="nc-name" className={labelClass}>Campsite name</label>
                <input
                  id="nc-name"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Celestial Glen"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="nc-price" className={labelClass}>Price per night ($)</label>
                <input
                  id="nc-price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={fieldClass}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="nc-location" className={labelClass}>Location</label>
              <input
                id="nc-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={fieldClass}
                placeholder="Region, country"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="nc-desc" className={labelClass}>Description</label>
              <textarea
                id="nc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${fieldClass} rounded-2xl min-h-[160px]`}
                placeholder="Tell the story of this landscape…"
                required
              />
            </div>

            <div className="pt-6 flex justify-center">
              <Magnetic strength={0.3}>
                <button
                  type="submit"
                  className="cursor-pointer px-16 py-5 bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-transform duration-200 hover:scale-[1.04] active:scale-95"
                >
                  Publish campsite
                </button>
              </Magnetic>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
