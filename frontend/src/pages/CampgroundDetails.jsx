import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import Magnetic from '../components/Magnetic';

export default function CampgroundDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campground, setCampground] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [social, setSocial] = useState({ likes: 0, dislikes: 0, user_vote: 0 });

  const fetchCampground = useCallback(async () => {
    try {
      const res = await api.get(`/index/${id}`);
      setCampground(res.data);
      // Fetch stats
      const statsRes = await api.get(`/index/${id}/social/stats`);
      setSocial(prev => ({ ...prev, ...statsRes.data }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCampground(); }, [fetchCampground]);

  const handleVote = async (type) => {
    if (!user) return navigate('/login');
    try {
      const res = await api.post(`/index/${id}/social/vote?vote_type=${type}`, {});
      setSocial({ likes: res.data.likes, dislikes: res.data.dislikes, user_vote: res.data.user_vote });
    } catch (err) { console.error(err); }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    try {
      await api.post(`/index/${id}/comments`, { text: comment });
      setComment('');
      fetchCampground();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    try {
      await api.post(`/index/${id}/delete`, {});
      navigate('/index');
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#030005] flex items-center justify-center">
       <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
    </div>
  );
  if (!campground) return <div className="min-h-screen bg-[#030005] pt-40 px-8 text-center text-white/20 uppercase tracking-[0.4em]">Sanctuary Not Found</div>;

  return (
    <div className="min-h-screen bg-[#030005] text-white">
      <div className="fixed inset-0 z-0">
        <AmbientAtmosphere />
      </div>

      <div className="relative z-10 pt-44 pb-20 px-8 lg:px-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16">
        
        {/* Left: Visual Content */}
        <div className="lg:col-span-7 space-y-12">
          <div className="relative rounded-[3rem] overflow-hidden aspect-[4/3] bento-card border-white/5 shadow-2xl">
             <img src={campground.image || "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=1200"} className="w-full h-full object-cover" alt={campground.name} />
             <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#030005] to-transparent"></div>
          </div>

          <div className="glass-obsidian rounded-[3rem] p-12 space-y-8 border border-white/5">
             <div className="flex justify-between items-start">
               <div>
                  <p className="text-[10px] font-bold tracking-[0.4em] text-indigo-400 uppercase mb-3">Elite Scouting Platform</p>
                  <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter leading-none">{campground.name}</h1>
               </div>
               <div className="text-right">
                  <p className="text-indigo-400 font-bold text-3xl tracking-tighter leading-none">${campground.price}<span className="text-white/20 text-xs ml-1 font-light uppercase tracking-widest">/Night</span></p>
               </div>
             </div>
             
             {/* Social Bar */}
             <div className="flex gap-6 items-center py-6 border-y border-white/5">
                <button 
                  onClick={() => handleVote(1)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-full border transition-all ${social.user_vote === 1 ? 'bg-indigo-500 border-indigo-400 text-white shadow-[0_5px_15px_rgba(79,70,229,0.3)]' : 'border-white/5 hover:border-white/20 text-white/40'}`}
                >
                   <span className="text-sm">▲</span>
                   <span className="text-xs font-bold uppercase tracking-widest">{social.likes} Likes</span>
                </button>
                <button 
                  onClick={() => handleVote(-1)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-full border transition-all ${social.user_vote === -1 ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'border-white/5 hover:border-white/20 text-white/40'}`}
                >
                   <span className="text-xs">▼</span>
                   <span className="text-xs font-bold uppercase tracking-widest">{social.dislikes}</span>
                </button>

                <div className="ml-auto flex -space-x-2">
                   {campground.liked_by && campground.liked_by.length > 0 ? (
                     campground.liked_by.map((voter, i) => (
                       <div key={voter.user_id || i} className="w-8 h-8 rounded-full border-2 border-[#030005] bg-indigo-500/20 overflow-hidden flex items-center justify-center text-[8px] font-black uppercase text-indigo-300" title={`@${voter.username}`}>
                         <img 
                           src={voter.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${voter.username || i}`} 
                           alt={voter.username} 
                           className="w-full h-full object-cover" 
                           onError={(e) => {
                             e.currentTarget.onerror = null;
                             e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${voter.username || i}`;
                           }}
                         />
                       </div>
                     ))
                   ) : (
                     [101, 102, 103].map(id => (
                       <div key={id} className="w-8 h-8 rounded-full border-2 border-[#030005] bg-indigo-500/20 overflow-hidden flex items-center justify-center opacity-60">
                         <img 
                           src={`https://api.dicebear.com/7.x/adventurer/svg?seed=scout_${id}`} 
                           alt="Scout" 
                           className="w-full h-full object-cover" 
                         />
                       </div>
                     ))
                   )}
                   {social.likes > (campground.liked_by?.length || 0) && (
                     <div className="w-8 h-8 rounded-full border-2 border-[#030005] bg-white/5 flex items-center justify-center text-[10px] text-white/40">
                       +{social.likes - (campground.liked_by?.length || 0)}
                     </div>
                   )}
                </div>
             </div>

             <p className="text-xl text-white/50 leading-relaxed font-light">{campground.description}</p>
             
             <div className="pt-8 flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-800 p-[1px] overflow-hidden">
                      <img 
                        src={campground.author_avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${campground.author_username || 'scout'}`} 
                        alt={campground.author_username} 
                        className="w-full h-full object-cover rounded-2xl" 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${campground.author_username || 'scout'}`;
                        }}
                      />
                   </div>
                   <div>
                      <p className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase leading-none mb-1">Chief Scout</p>
                      <p className="text-sm font-bold text-white/80">{campground.author_username}</p>
                   </div>
                </div>

                {user && user.id === campground.author_id && (
                  <div className="flex gap-6">
                    <Link to={`/campgrounds/${id}/edit`} className="text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white transition-colors">Edit Archive</Link>
                    <button onClick={handleDelete} className="text-[10px] font-bold uppercase tracking-widest text-red-500/30 hover:text-red-500 transition-colors">Purge Entry</button>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Right: Interaction */}
        <div className="lg:col-span-5 space-y-8">
           <div className="glass-obsidian-strong rounded-[3rem] p-12 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 text-4xl opacity-5">❝</div>
              <h2 className="text-2xl font-display font-black tracking-tighter mb-8 leading-none">Sector Insights</h2>
              
              {/* Form */}
              <form onSubmit={handleComment} className="mb-12 relative z-10">
                 <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Log your scouting data..."
                    className="w-full px-8 py-6 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] text-sm text-white focus:outline-none focus:border-indigo-500/30 transition-all min-h-[140px] font-light placeholder:text-white/10"
                    required
                 />
                 <div className="flex justify-end mt-4">
                    <Magnetic strength={0.2}>
                       <button type="submit" className="px-10 py-5 bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-[0_10px_30px_rgba(79,70,229,0.2)] transition-all">
                          Commit Log
                       </button>
                    </Magnetic>
                 </div>
              </form>

              {/* Comments List */}
              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                 {campground.comments?.map(c => (
                   <div key={c.id} className="p-8 rounded-[2rem] bg-white/[0.01] border border-white/[0.02] hover:border-white/[0.05] transition-colors">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/40 p-[1px] overflow-hidden">
                            <img 
                              src={c.author_avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.author_username || 'scout'}`} 
                              alt={c.author_username} 
                              className="w-full h-full object-cover rounded-full" 
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.author_username || 'scout'}`;
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-black tracking-[0.3em] text-indigo-400 uppercase">@{c.author_username}</span>
                        </div>
                        <span className="text-[10px] text-white/10 uppercase tracking-widest font-bold">Vetted</span>
                      </div>
                      <p className="text-sm text-white/30 font-light leading-relaxed pl-10">{c.text}</p>
                   </div>
                 ))}
                 {campground.comments?.length === 0 && (
                   <div className="text-center py-12 text-white/10 text-[10px] font-bold uppercase tracking-widest">No intelligence logs found for this sector.</div>
                 )}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
