import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute
 * Protects private views from unauthorized access.
 * If user is not authenticated, redirects to /login preserving the return location in state.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-background" aria-label="Authenticating session">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-sky-400/20 border-t-sky-400 animate-spin" />
          <span className="text-xs uppercase tracking-[0.2em] text-fg-subtle">Verifying credentials...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
