import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * GoogleSignInButton
 * Redesigned custom Google authentication control tailored to Meadows' dark Aurora theme.
 * Uses a seamless overlay architecture for 100% native OAuth compliance without jarring stock iframes.
 */
export default function GoogleSignInButton({ text = "continue_with" }) {
  const btnRef = useRef(null);
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    "336040317357-vrvh1mav4sth7gds73d3vst086gog8n3.apps.googleusercontent.com";

  let buttonLabel = "Continue with Google";
  if (text === "signup_with") buttonLabel = "Sign up with Google";
  else if (text === "signin_with") buttonLabel = "Sign in with Google";

  useEffect(() => {
    let checkInterval = null;

    const initGoogle = () => {
      if (window.google?.accounts?.id && btnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Render official button into transparent overlay container
          window.google.accounts.id.renderButton(btnRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: text,
            shape: 'rectangular',
            width: btnRef.current.offsetWidth || 380,
            logo_alignment: 'left',
          });

          if (checkInterval) clearInterval(checkInterval);
        } catch (e) {
          console.warn('Google identity init error:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      checkInterval = setInterval(initGoogle, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [clientId, text]);

  const handleCredentialResponse = async (response) => {
    if (!response?.credential) return;
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle(response.credential);
      const from = location.state?.from?.pathname
        ? (location.state.from.pathname + (location.state.from.search || '') + (location.state.from.hash || ''))
        : (typeof location.state?.from === 'string' ? location.state.from : '/campgrounds');
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Google login error:', err);
      const detail = err.response?.data?.detail || err.message || 'Google authentication failed';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleManualPrompt = () => {
    if (window.google?.accounts?.id && !loading) {
      try {
        window.google.accounts.id.prompt();
      } catch (e) {
        console.warn('Google prompt trigger:', e);
      }
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {error && (
        <div className="w-full mb-3 p-3 bg-destructive/10 border border-destructive/25 text-destructive text-xs rounded-xl font-medium text-center">
          {error}
        </div>
      )}

      {/* Styled Aurora Button Container */}
      <div
        onClick={handleManualPrompt}
        className={`group relative w-full py-4 px-5 bg-surface/90 hover:bg-surface border border-border hover:border-secondary/50 rounded-xl transition-all duration-200 shadow-sm hover:shadow-[0_0_25px_rgba(56,189,248,0.12)] flex items-center justify-center gap-3 select-none overflow-hidden ${
          loading ? 'pointer-events-none' : 'cursor-pointer active:scale-[0.99]'
        }`}
      >
        {/* Subtle hover luminous sheen */}
        <span
          className="absolute inset-0 bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          aria-hidden="true"
        />

        {/* Official Google Multicolor Vector Icon */}
        <svg
          className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
            loading ? 'opacity-50' : 'group-hover:scale-110'
          }`}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>

        {/* Button Label */}
        <span
          className={`text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 ${
            loading ? 'text-secondary animate-pulse' : 'text-fg group-hover:text-white'
          }`}
        >
          {loading ? 'Connecting to Google...' : buttonLabel}
        </span>

        {/* Horizontal Loading Progress Bar (animates smoothly along the bottom border, never rotates) */}
        {loading && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1 bg-border/40 overflow-hidden rounded-b-xl"
            role="progressbar"
            aria-label="Connecting to Google"
          >
            <div className="h-full bg-gradient-to-r from-primary via-secondary to-sky-300 animate-indeterminate-bar w-1/3 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.7)]" />
          </div>
        )}

        {/* Seamless Transparent Google Iframe Overlay */}
        {!loading && (
          <div
            ref={btnRef}
            className="absolute inset-0 w-full h-full opacity-[0.001] cursor-pointer overflow-hidden z-20 flex items-center justify-center pointer-events-auto"
            title={buttonLabel}
            aria-label={buttonLabel}
          />
        )}
      </div>
    </div>
  );
}
