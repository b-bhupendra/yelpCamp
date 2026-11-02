import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';

// In-memory SWR cache for instant transitions and zero skeleton time on revisit
const campgroundsCache = new Map();

export function useCampgrounds({ initialSearch = '', initialPage = 1, debounceMs = 300 } = {}) {
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);

  const cacheKey = `${initialSearch}_page_${initialPage}`;
  const cachedData = campgroundsCache.get(cacheKey);

  const [campgrounds, setCampgrounds] = useState(cachedData?.items || []);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(cachedData?.total ?? 0);
  const [totalPages, setTotalPages] = useState(cachedData?.totalPages ?? 1);
  const [hasNext, setHasNext] = useState(cachedData?.hasNext ?? false);
  const [hasPrev, setHasPrev] = useState(cachedData?.hasPrev ?? false);

  const isFirstMount = useRef(true);
  const searchTimeoutRef = useRef(null);

  // Stable core fetcher that does not depend on changing states
  const fetchPage = useCallback(async (searchQuery, pageNum) => {
    const currentKey = `${searchQuery || ''}_page_${pageNum}`;
    const cached = campgroundsCache.get(currentKey);

    if (cached) {
      setCampgrounds(cached.items);
      setTotal(cached.total);
      setTotalPages(cached.totalPages);
      setHasNext(cached.hasNext);
      setHasPrev(cached.hasPrev);
    } else {
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

      const items = res.data.items || res.data.campgrounds || (Array.isArray(res.data) ? res.data : []);
      const newTotal = res.data.total ?? items.length;
      const newPage = res.data.page ?? pageNum;
      const newTotalPages = res.data.total_pages ?? res.data.pages ?? Math.max(1, Math.ceil(newTotal / 12));
      const newHasNext = res.data.has_next ?? (newPage < newTotalPages);
      const newHasPrev = res.data.has_prev ?? (newPage > 1);

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
  }, []);

  // Debounce search input and reset page to 1
  useEffect(() => {
    if (isFirstMount.current) {
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, debounceMs);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search, debounceMs]);

  // Fetch when debouncedSearch or page changes
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
    }
    fetchPage(debouncedSearch, page);
  }, [debouncedSearch, page, fetchPage]);

  // Safe page changer that clamps page to valid bounds
  const changePage = useCallback((newPage) => {
    setPage((prev) => {
      const target = typeof newPage === 'function' ? newPage(prev) : newPage;
      return Math.max(1, target);
    });
  }, []);

  return {
    campgrounds,
    loading,
    error,
    search,
    setSearch,
    total,
    page,
    setPage: changePage,
    totalPages,
    hasNext,
    hasPrev,
    refetch: () => fetchPage(debouncedSearch, page),
  };
}

export default useCampgrounds;
