import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(username, password);
      navigate('/index');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Try a different username.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#050208]">
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_30%,rgba(236,72,153,0.04),transparent)]"></div>

      <div className="relative w-full max-w-md reveal">
        {/* Header */}
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-pink-400/30 mb-4">
            Get Started
          </p>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight text-white leading-tight">
            Create Account
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/5 border border-red-500/10 text-red-400/80 text-sm rounded-2xl font-medium">
            {error}
          </div>
        )}

        {/* Google Authentication */}
        <div className="mb-6">
          <GoogleSignInButton text="signup_with" />
        </div>

        {/* Divider */}
        <div className="relative my-8 flex items-center justify-center">
          <div className="border-t border-white/[0.08] w-full"></div>
          <span className="bg-[#050208] px-4 text-[10px] uppercase font-bold tracking-[0.25em] text-white/30 shrink-0">
            Or register with credentials
          </span>
          <div className="border-t border-white/[0.08] w-full"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-white/20 mb-3">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-6 py-4 bg-white/[0.03] border border-white/[0.06] rounded-xl focus:outline-none focus:border-pink-500/30 focus:bg-white/[0.05] transition-all duration-500 text-white placeholder-white/10 font-light"
              placeholder="Choose a username"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-white/20 mb-3">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-white/[0.03] border border-white/[0.06] rounded-xl focus:outline-none focus:border-pink-500/30 focus:bg-white/[0.05] transition-all duration-500 text-white placeholder-white/10 font-light"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="group relative w-full py-4 mt-4 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 rounded-xl font-bold text-sm text-white transition-all duration-500 hover:shadow-[0_10px_40px_-10px_rgba(236,72,153,0.4)] active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/15 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
            <span className="relative">Create Account</span>
          </button>
        </form>

        <p className="mt-10 text-center text-white/15 text-sm font-light">
          Already have an account?{' '}
          <Link to="/login" className="text-white/50 hover:text-white font-medium transition-colors duration-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
