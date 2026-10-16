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
      navigate('/campgrounds');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Try a different username.');
    }
  };

  const fieldClass = "w-full px-5 py-4 bg-surface border border-border rounded-xl focus:outline-none focus:border-secondary focus:ring-2 focus:ring-ring/30 transition-colors text-fg placeholder:text-fg-subtle";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_25%,rgba(234,88,12,0.10),transparent)]" aria-hidden="true" />

      <div className="relative w-full max-w-md animate-mask-up">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent mb-4">Get started</p>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight text-fg leading-tight">Create account</h1>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-destructive/10 border border-destructive/25 text-destructive text-sm rounded-xl" role="alert">
            {error}
          </div>
        )}

        <div className="mb-6">
          <GoogleSignInButton text="signup_with" />
        </div>

        <div className="relative my-8 flex items-center justify-center">
          <div className="border-t border-border w-full" />
          <span className="bg-background px-4 text-xs uppercase font-semibold tracking-[0.2em] text-fg-subtle shrink-0">
            Or with credentials
          </span>
          <div className="border-t border-border w-full" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="reg-username" className="block text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted mb-2.5">
              Username
            </label>
            <input
              id="reg-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={fieldClass}
              placeholder="Choose a username"
              required
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted mb-2.5">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="cursor-pointer group relative w-full py-4 mt-2 rounded-xl font-bold text-sm text-on-primary overflow-hidden transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-sky-300" aria-hidden="true" />
            <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" aria-hidden="true" />
            <span className="relative">Create account</span>
          </button>
        </form>

        <p className="mt-10 text-center text-fg-subtle text-sm">
          Already have an account?{' '}
          <Link to="/login" className="cursor-pointer text-secondary hover:text-fg font-semibold transition-colors duration-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
