import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/index');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    }
  };

  const fieldClass = "w-full px-5 py-4 bg-surface border border-border rounded-xl focus:outline-none focus:border-secondary focus:ring-2 focus:ring-ring/30 transition-colors text-fg placeholder:text-fg-subtle";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_25%,rgba(56,189,248,0.10),transparent)]" aria-hidden="true" />

      <div className="relative w-full max-w-md animate-mask-up">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary mb-4">Welcome back</p>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight text-fg leading-tight">Sign in</h1>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-destructive/10 border border-destructive/25 text-destructive text-sm rounded-xl" role="alert">
            {error}
          </div>
        )}

        <div className="mb-6">
          <GoogleSignInButton text="signin_with" />
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
            <label htmlFor="login-username" className="block text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted mb-2.5">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={fieldClass}
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted mb-2.5">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="cursor-pointer w-full py-4 mt-2 bg-primary text-on-primary rounded-xl font-bold text-sm transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Continue
          </button>
        </form>

        <p className="mt-10 text-center text-fg-subtle text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="cursor-pointer text-secondary hover:text-fg font-semibold transition-colors duration-200">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
