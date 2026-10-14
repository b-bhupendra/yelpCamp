import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api';

function EditCampground() {
  const { id } = useParams();
  const [formData, setFormData] = useState({ name: '', price: '', image: '', description: '' });
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
          description: response.data.description,
        });
      } catch (err) {
        setError('Failed to load campsite data, or you are not authorized.');
      } finally {
        setLoading(false);
      }
    };
    fetchCampground();
  }, [id]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach((key) => data.append(key, formData[key]));
      await api.post(`/index/${id}/edit`, data);
      navigate(`/campgrounds/${id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update campsite.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-2 border-border border-t-secondary rounded-full animate-spin" role="status" aria-label="Loading" />
    </div>
  );

  const fieldClass = "w-full px-5 py-4 bg-surface border border-border rounded-2xl focus:outline-none focus:border-secondary focus:ring-2 focus:ring-ring/30 transition-colors text-fg placeholder:text-fg-subtle";
  const labelClass = "block text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted mb-2 ml-1";

  return (
    <div className="min-h-screen pt-36 md:pt-44 pb-20 px-6 flex items-center justify-center bg-background relative overflow-hidden">
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.08),transparent_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl glass-obsidian-strong border border-border p-10 md:p-14 rounded-3xl shadow-2xl animate-mask-up">
        <p className="text-xs font-semibold tracking-[0.3em] text-secondary uppercase mb-4">Edit campsite</p>
        <h2 className="text-4xl md:text-5xl font-display font-black mb-6 tracking-tight leading-tight text-fg">
          Refine the <br /> <span className="aurora-text">details.</span>
        </h2>

        {error && (
          <div className="mb-8 p-4 bg-destructive/10 border border-destructive/25 text-destructive text-sm rounded-2xl" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="ec-name" className={labelClass}>Name</label>
              <input id="ec-name" type="text" name="name" value={formData.name} onChange={handleChange} className={fieldClass} required />
            </div>
            <div>
              <label htmlFor="ec-price" className={labelClass}>Price</label>
              <input id="ec-price" type="number" name="price" value={formData.price} onChange={handleChange} className={fieldClass} required />
            </div>
          </div>

          <div>
            <label htmlFor="ec-image" className={labelClass}>Image URL</label>
            <input id="ec-image" type="text" name="image" value={formData.image} onChange={handleChange} className={`${fieldClass} font-mono text-sm`} required />
          </div>

          <div>
            <label htmlFor="ec-desc" className={labelClass}>Description</label>
            <textarea id="ec-desc" name="description" value={formData.description} onChange={handleChange} className={`${fieldClass} min-h-[150px] resize-none`} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className={`cursor-pointer py-5 bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-transform duration-200 hover:scale-[1.02] active:scale-95 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <Link
              to={`/campgrounds/${id}`}
              className="cursor-pointer py-5 border border-border-strong hover:border-secondary text-fg rounded-full text-center font-bold text-xs uppercase tracking-[0.2em] transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditCampground;
