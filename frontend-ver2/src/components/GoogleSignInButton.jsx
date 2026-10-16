import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function GoogleSignInButton({ text = "continue_with" }) {
  const btnRef = useRef(null);
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "336040317357-vrvh1mav4sth7gds73d3vst086gog8n3.apps.googleusercontent.com";

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

          // Render official Google button
          window.google.accounts.id.renderButton(btnRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: text,
            shape: 'pill',
            width: btnRef.current.offsetWidth || 340,
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
      navigate('/campgrounds');
    } catch (err) {
      console.error('Google login error:', err);
      const detail = err.response?.data?.detail || err.message || 'Google authentication failed';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {error && (
        <div className="w-full mb-3 p-3 bg-destructive/10 border border-destructive/25 text-destructive text-xs rounded-xl font-medium text-center">
          {error}
        </div>
      )}

      {loading ? (
        <div className="w-full py-3.5 flex items-center justify-center gap-3 bg-surface border border-border rounded-full text-fg-muted text-xs font-semibold">
          <div className="w-4 h-4 border-2 border-border border-t-secondary rounded-full animate-spin"></div>
          Authenticating with Google...
        </div>
      ) : (
        <div className="w-full flex justify-center">
          <div ref={btnRef} className="w-full min-h-[44px] flex justify-center"></div>
        </div>
      )}
    </div>
  );
}
