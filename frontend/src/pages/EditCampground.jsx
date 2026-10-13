import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api';

function EditCampground() {
  const { id } = useParams();
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    image: '',
    description: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCampground = async () => {
      try {
        const response = await api.get(`/index/${id}/edit`);
        setFormData({
          name: response.data.name,
          price: response.data.price,
          image: response.data.image,
          description: response.data.description
        });
      } catch (err) {
        setError('Failed to load campsite data or you are not authorized.');
      } finally {
        setLoading(false);
      }
    };
    fetchCampground();
  }, [id]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      
      await api.post(`/index/${id}/edit`, data);
      navigate(`/campgrounds/${id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update campground.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#08060d]">
      <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen pt-44 pb-20 px-6 flex items-center justify-center bg-[#030005] relative overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(129,140,248,0.08),transparent_70%)]"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl glass-obsidian-strong border border-white/5 p-16 rounded-[4rem] shadow-2xl animate-mask-up">
        <p className="text-[10px] font-bold tracking-[0.6em] text-indigo-400 uppercase mb-4">Tactical Edit</p>
        <h2 className="text-5xl font-display font-black mb-6 tracking-tighter leading-tight text-white">
          Refine the <br /> <span className="text-indigo-400">Sanctuary.</span>
        </h2>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-purple-200/60 mb-2 ml-1 uppercase tracking-widest">Name</label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-200/60 mb-2 ml-1 uppercase tracking-widest">Price</label>
              <input 
                type="number" 
                name="price"
                value={formData.price}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200/60 mb-2 ml-1 uppercase tracking-widest">Visual Path (URL)</label>
            <input 
              type="text" 
              name="image"
              value={formData.image}
              onChange={handleChange}
              className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all text-white font-mono text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200/60 mb-2 ml-1 uppercase tracking-widest">Lore (Description)</label>
            <textarea 
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all text-white min-h-[150px] resize-none"
              required
            ></textarea>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4">
            <button 
              type="submit"
              disabled={saving}
              className={`py-6 bg-indigo-500 text-white rounded-full font-black text-[10px] uppercase tracking-[0.3em] transition-all hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(79,70,229,0.3)] ${saving ? 'opacity-50' : ''}`}
            >
              {saving ? 'Processing...' : 'Deploy Changes'}
            </button>
            <Link 
              to={`/campgrounds/${id}`}
              className="py-6 border border-white/10 hover:border-white/20 text-white rounded-full text-center font-black text-[10px] uppercase tracking-[0.3em] transition-all"
            >
              Abort Sync
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditCampground;
