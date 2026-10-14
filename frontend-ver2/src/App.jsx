import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import { AuthProvider } from './context/AuthContext';
import CustomCursor from './components/CustomCursor';
import SmoothScroll from './components/SmoothScroll';
import AIAssistantDock from './components/AIAssistantDock';

// Route-level code-splitting for secondary views
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const CampgroundList = lazy(() => import('./pages/CampgroundList'));
const CampgroundDetails = lazy(() => import('./pages/CampgroundDetails'));
const NewCampground = lazy(() => import('./pages/NewCampground'));
const EditCampground = lazy(() => import('./pages/EditCampground'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

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
    <AuthProvider>
      <SmoothScroll>
        <Router>
          <CustomCursor />
          <div className="min-h-screen bg-background text-fg selection:bg-secondary/30">
            <Navbar />
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/index" element={<CampgroundList />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/campgrounds/new" element={<NewCampground />} />
                <Route path="/campgrounds/:id" element={<CampgroundDetails />} />
                <Route path="/campgrounds/:id/edit" element={<EditCampground />} />
              </Routes>
            </Suspense>
            <AIAssistantDock />
          </div>
        </Router>
      </SmoothScroll>
    </AuthProvider>
  );
}

export default App;
