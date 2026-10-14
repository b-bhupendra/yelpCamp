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
        description
      });
      navigate('/index');
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to create sanctuary. Ensure you are logged in.');
    }
  };

  return (
    <div className="min-h-screen relative bg-[#030005] selection:bg-indigo-500/20">
      <div className="fixed inset-0 z-0">
        <AmbientAtmosphere />
      </div>

      <div className="relative z-10 pt-44 pb-20 px-8 flex justify-center">
        <div className="w-full max-w-2xl reveal animate-mask-up">
          
          <div className="mb-12">
            <p className="text-[11px] font-bold tracking-[0.5em] text-indigo-400/50 uppercase mb-4">The Forge</p>
            <h1 className="text-5xl md:text-7xl font-display font-black tracking-tighter leading-none text-white">
              Unveil a <br /> Sanctuary.
            </h1>
          </div>

          {error && (
            <div className="mb-8 p-6 glass-obsidian border-red-500/20 text-red-400/80 text-sm rounded-3xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 ml-6">Sanctuary Name</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-8 py-5 bg-white/[0.02] border border-white/[0.05] rounded-3xl text-sm focus:outline-none focus:border-indigo-500/30 transition-all font-light"
                  placeholder="e.g. Celestial Glen"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 ml-6">Nightly Tribute ($)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-8 py-5 bg-white/[0.02] border border-white/[0.05] rounded-3xl text-sm focus:outline-none focus:border-indigo-500/30 transition-all font-light"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 ml-6">Geographic Anchor</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-8 py-5 bg-white/[0.02] border border-white/[0.05] rounded-3xl text-sm focus:outline-none focus:border-indigo-500/30 transition-all font-light"
                placeholder="Region, Earth"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 ml-6">The Narrative</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-8 py-6 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] text-sm focus:outline-none focus:border-indigo-500/30 transition-all min-h-[180px] font-light"
                placeholder="Tell the story of this landscape..."
                required
              />
            </div>

            <div className="pt-8 flex justify-center">
              <Magnetic strength={0.3}>
                <button
                  type="submit"
                  className="px-20 py-6 bg-white text-black rounded-full font-black text-xs uppercase tracking-[0.3em] transition-all hover:scale-105 active:scale-95 hover:shadow-[0_0_50px_rgba(255,255,255,0.2)]"
                >
                  Confirm Discovery
                </button>
              </Magnetic>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
