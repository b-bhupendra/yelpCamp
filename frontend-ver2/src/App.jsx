import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import { AuthProvider } from './context/AuthContext';
import { AgentProvider } from './context/AgentContext';
import { ToastProvider } from './context/ToastContext';
import GlobalErrorBoundary from './components/layout/GlobalErrorBoundary';
import AppLayout from './components/layout/AppLayout';

// Route-level code-splitting for secondary views
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const CampgroundList = lazy(() => import('./pages/CampgroundList'));
const CampgroundDetails = lazy(() => import('./pages/CampgroundDetails'));
const NewCampground = lazy(() => import('./pages/NewCampground'));
const EditCampground = lazy(() => import('./pages/EditCampground'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteLoadingFallback() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-background" aria-label="Loading page">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-sky-400/20 border-t-sky-400 animate-spin" />
        <span className="text-xs uppercase tracking-[0.2em] text-fg-subtle">Preparing Trail...</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <AgentProvider>
              <AppLayout>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/campgrounds" element={<CampgroundList />} />
                    <Route path="/explore" element={<CampgroundList />} />
                    <Route path="/index" element={<Navigate to="/campgrounds" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/campgrounds/new" element={<NewCampground />} />
                    <Route path="/campgrounds/:id" element={<CampgroundDetails />} />
                    <Route path="/campgrounds/:id/edit" element={<EditCampground />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            </AgentProvider>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
