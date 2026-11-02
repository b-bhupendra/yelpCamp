import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';

// In-memory SWR cache for instant transitions and zero skeleton time on revisit
const campgroundsCache = new Map();

export function useCampgrounds({ initialSearch = '', debounceMs = 300 } = {}) {
  const cacheKey = `${initialSearch}_page_1`;
  const cachedData = campgroundsCache.get(cacheKey);

  const [campgrounds, setCampgrounds] = useState(cachedData?.items || []);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(initialSearch);
  const [total, setTotal] = useState(cachedData?.total ?? 0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(cachedData?.totalPages ?? 1);
  const [hasNext, setHasNext] = useState(cachedData?.hasNext ?? false);
  const [hasPrev, setHasPrev] = useState(cachedData?.hasPrev ?? false);
  const timerRef = useRef(null);
  const isFirstMount = useRef(true);

  const fetchCampgrounds = useCallback(async (searchQuery = search, pageNum = page) => {
    const currentKey = `${searchQuery || ''}_page_${pageNum}`;
    const cached = campgroundsCache.get(currentKey);

    // If no cache, show loading skeleton; otherwise revalidate silently in background
    if (!cached) {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await api.get('/api/v1/campgrounds', {
        params: {
          search: searchQuery || undefined,
          page: pageNum,
          limit: 12,
        },
      });

      const items = res.data.items || (Array.isArray(res.data) ? res.data : []);
      const newTotal = res.data.total ?? items.length;
      const newPage = res.data.page ?? pageNum;
      const newTotalPages = res.data.total_pages ?? 1;
      const newHasNext = res.data.has_next ?? (newPage < newTotalPages);
      const newHasPrev = res.data.has_prev ?? (newPage > 1);

      // Update cache
      campgroundsCache.set(currentKey, {
        items,
        total: newTotal,
        page: newPage,
        totalPages: newTotalPages,
        hasNext: newHasNext,
        hasPrev: newHasPrev,
        timestamp: Date.now(),
      });

      setCampgrounds(items);
      setTotal(newTotal);
      setPage(newPage);
      setTotalPages(newTotalPages);
      setHasNext(newHasNext);
      setHasPrev(newHasPrev);
    } catch (err) {
      console.error('Failed to fetch campgrounds:', err);
      if (!cached) {
        setError(err.response?.data?.detail || 'Failed to load campsites from network.');
        setCampgrounds([]);
      }
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  // Initial fetch immediate; search updates debounced
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      fetchCampgrounds(search, 1);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchCampgrounds(search, 1);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search, debounceMs, fetchCampgrounds]);

  return {
    campgrounds,
    loading,
    error,
    search,
    setSearch,
    total,
    page,
    setPage,
    totalPages,
    hasNext,
    hasPrev,
    refetch: fetchCampgrounds,
  };
}

export default useCampgrounds;
