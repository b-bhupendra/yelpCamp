import React, { createContext, useContext, useState, useCallback } from 'react';
import Icon from '../components/Icons';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ message, title = '', type = 'info', duration = 3500 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { id, message, title, type, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (message, title = 'Success') => addToast({ message, title, type: 'success' }),
    error: (message, title = 'Error') => addToast({ message, title, type: 'error', duration: 4500 }),
    info: (message, title = 'Notice') => addToast({ message, title, type: 'info' }),
    warning: (message, title = 'Warning') => addToast({ message, title, type: 'warning', duration: 4000 }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Notification Container */}
      <div
        aria-live="polite"
        role="status"
        aria-label="Notifications"
        className="fixed top-20 right-4 sm:right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none select-none"
      >
        {toasts.map((t) => {
          let borderTheme = 'border-sky-500/40 text-sky-400 bg-sky-950/80';
          let icon = <Icon.Compass size={18} className="text-sky-400 shrink-0" />;

          if (t.type === 'success') {
            borderTheme = 'border-emerald-500/40 text-emerald-400 bg-emerald-950/85';
            icon = <Icon.Check size={18} className="text-emerald-400 shrink-0" />;
          } else if (t.type === 'error') {
            borderTheme = 'border-rose-500/50 text-rose-400 bg-rose-950/85';
            icon = <Icon.Close size={18} className="text-rose-400 shrink-0" />;
          } else if (t.type === 'warning') {
            borderTheme = 'border-amber-500/50 text-amber-400 bg-amber-950/85';
            icon = <Icon.Flame size={18} className="text-amber-400 shrink-0" />;
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-4 rounded-2xl border backdrop-blur-xl shadow-2xl shadow-black/60 flex items-start justify-between gap-3 animate-mask-up transition-all ${borderTheme}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{icon}</div>
                <div className="flex flex-col">
                  {t.title && (
                    <span className="font-display font-bold text-xs uppercase tracking-wider text-fg leading-none mb-1">
                      {t.title}
                    </span>
                  )}
                  <p className="text-xs text-fg-muted font-medium leading-relaxed">
                    {t.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
                className="cursor-pointer min-w-[32px] min-h-[32px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-lg text-fg-subtle hover:text-fg hover:bg-white/10 transition-colors"
              >
                <Icon.Close size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
