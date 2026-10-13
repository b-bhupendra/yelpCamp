import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import CampgroundList from './pages/CampgroundList';
import CampgroundDetails from './pages/CampgroundDetails';
import NewCampground from './pages/NewCampground';
import EditCampground from './pages/EditCampground';
import Dashboard from './pages/Dashboard';
import { AuthProvider } from './context/AuthContext';

import CustomCursor from './components/CustomCursor';

import SmoothScroll from './components/SmoothScroll';

function App() {
  return (
    <AuthProvider>
      <SmoothScroll>
        <Router>
          <CustomCursor />
          <div className="min-h-screen bg-[#030005] text-white selection:bg-indigo-500/30">
          <Navbar />
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
        </div>
      </Router>
      </SmoothScroll>
    </AuthProvider>
  );
}

export default App;
