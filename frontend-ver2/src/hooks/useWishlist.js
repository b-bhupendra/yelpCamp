import { useState, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function useWishlist({ campgroundId, initialWishlisted = false } = {}) {
  const { user } = useAuth();
  const toast = useToast();
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted);
  const [loading, setLoading] = useState(false);

  const toggleWishlist = useCallback(async (targetId = campgroundId) => {
    if (!user) {
      toast.warning('Please log in to save campsites to your wishlist.');
      return false;
    }
    if (!targetId) return false;

    // Optimistic toggle
    const previous = isWishlisted;
    setIsWishlisted(!previous);
    setLoading(true);

    try {
      const res = await api.post(`/api/campgrounds/${targetId}/wishlist`);
      const newStatus = res.data.is_wishlisted;
      setIsWishlisted(newStatus);
      if (newStatus) {
        toast.success('Saved campsite to your expedition wishlist.');
      } else {
        toast.info('Removed from your wishlist.');
      }
      return newStatus;
    } catch (err) {
      console.error('Wishlist toggle error:', err);
      // Revert optimistic state
      setIsWishlisted(previous);
      toast.error('Could not update wishlist. Check your connection.');
      return previous;
    } finally {
      setLoading(false);
    }
  }, [user, campgroundId, isWishlisted, toast]);

  return {
    isWishlisted,
    setIsWishlisted,
    toggleWishlist,
    loading,
  };
}

export default useWishlist;
