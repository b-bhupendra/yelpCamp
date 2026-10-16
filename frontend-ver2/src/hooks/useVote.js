import { useState, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function useVote({ campgroundId, initialLikes = 0, initialDislikes = 0, initialUserVote = 0 } = {}) {
  const { user } = useAuth();
  const toast = useToast();
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [userVote, setUserVote] = useState(initialUserVote);
  const [loading, setLoading] = useState(false);

  const setStats = useCallback(({ likes: l, dislikes: d, user_vote: uv }) => {
    if (typeof l === 'number') setLikes(l);
    if (typeof d === 'number') setDislikes(d);
    if (typeof uv === 'number') setUserVote(uv);
  }, []);

  const castVote = useCallback(async (type) => {
    if (!user) {
      toast.warning('Please log in to vote on campsite ratings.');
      return;
    }
    if (!campgroundId) return;

    // Snapshot for rollback
    const prevLikes = likes;
    const prevDislikes = dislikes;
    const prevUserVote = userVote;

    // Optimistic calculation
    if (userVote === type) {
      // Toggle off
      setUserVote(0);
      if (type === 1) setLikes(Math.max(0, likes - 1));
      else setDislikes(Math.max(0, dislikes - 1));
    } else {
      // Switching or adding
      if (userVote === 1) setLikes(Math.max(0, likes - 1));
      if (userVote === -1) setDislikes(Math.max(0, dislikes - 1));

      setUserVote(type);
      if (type === 1) setLikes(likes + 1);
      else setDislikes(dislikes + 1);
    }

    setLoading(true);
    try {
      const res = await api.post(`/api/campgrounds/${campgroundId}/vote?vote_type=${type}`, {});
      setLikes(res.data.likes);
      setDislikes(res.data.dislikes);
      setUserVote(res.data.user_vote);
      if (res.data.user_vote === 1) toast.success('Upvoted campsite!');
      else if (res.data.user_vote === -1) toast.info('Downvoted campsite.');
    } catch (err) {
      console.error('Vote failed:', err);
      // Rollback
      setLikes(prevLikes);
      setDislikes(prevDislikes);
      setUserVote(prevUserVote);
      toast.error('Failed to submit vote. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, campgroundId, likes, dislikes, userVote, toast]);

  return {
    likes,
    dislikes,
    userVote,
    castVote,
    setStats,
    loading,
  };
}

export default useVote;
