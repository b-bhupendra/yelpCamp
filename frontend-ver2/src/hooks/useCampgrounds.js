import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';

export function useCampgrounds({ initialSearch = '', debounceMs = 300 } = {}) {
  const [campgrounds, setCampgrounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(initialSearch);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const timerRef = useRef(null);

  const fetchCampgrounds = useCallback(async (searchQuery = search, pageNum = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/campgrounds', {
        params: {
          search: searchQuery || undefined,
          page: pageNum,
          limit: 20,
        },
      });

      const items = res.data.items || (Array.isArray(res.data) ? res.data : []);
      setCampgrounds(items);
      setTotal(res.data.total ?? items.length);
      setPage(res.data.page ?? pageNum);
      setTotalPages(res.data.total_pages ?? 1);
    } catch (err) {
      console.error('Failed to fetch campgrounds:', err);
      setError(err.response?.data?.detail || 'Failed to load campsites from network.');
      setCampgrounds([]);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
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
    totalPages,
    refetch: fetchCampgrounds,
  };
}

export default useCampgrounds;
