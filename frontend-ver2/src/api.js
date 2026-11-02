import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('meadows_token') || localStorage.getItem('yelpcamp_token');
  if (token) {
    // Proactively check if JWT token is expired before sending out any request
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 <= Date.now()) {
          console.warn('[Auth] Stored token expired client-side. Clearing credentials before request.');
          localStorage.removeItem('meadows_token');
          localStorage.removeItem('meadows_user');
          localStorage.removeItem('yelpcamp_token');
          localStorage.removeItem('yelpcamp_user');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('auth:expired', {
                detail: {
                  path: window.location.pathname + window.location.search,
                  status: 401,
                  reason: 'expired_jwt',
                },
              })
            );
          }
          return config;
        }
      }
    } catch {
      // Non-standard token; let server validate
    }

    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to catch 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Don't treat failed login/register attempts as session expirations
      const isAuthEndpoint =
        url.includes('/api/v1/login') ||
        url.includes('/api/v1/register') ||
        url.includes('/api/v1/auth/google');

      if (!isAuthEndpoint) {
        const hadToken = !!(localStorage.getItem('meadows_token') || localStorage.getItem('yelpcamp_token'));
        localStorage.removeItem('meadows_token');
        localStorage.removeItem('meadows_user');
        localStorage.removeItem('yelpcamp_token');
        localStorage.removeItem('yelpcamp_user');

        if (hadToken && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('auth:expired', {
              detail: {
                path: window.location.pathname + window.location.search,
                status: 401,
              },
            })
          );
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
