import React from 'react';
import Icon from '../Icons';

export class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error in UI component tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/campgrounds';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen bg-background text-fg flex items-center justify-center p-6 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,rgba(234,88,12,0.12),transparent)] pointer-events-none" />

          <div className="relative max-w-lg w-full glass-obsidian-strong border border-border/80 rounded-3xl p-8 sm:p-10 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <Icon.Flame size={30} />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-secondary">
                Trail Disrupted
              </span>
              <h1 className="text-2xl sm:text-3xl font-display font-black text-fg">
                Something went wrong on the path
              </h1>
              <p className="text-xs sm:text-sm text-fg-muted leading-relaxed">
                An unexpected technical disturbance occurred while loading this view. You can reload the trail or return to base camp safely.
              </p>
            </div>

            {/* Error Message Snippet */}
            {this.state.error?.message && (
              <div className="bg-surface-2/60 border border-border rounded-xl p-3 text-left overflow-x-auto text-[11px] font-mono text-rose-300/90">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="cursor-pointer w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-full bg-primary text-on-primary font-bold text-xs uppercase tracking-wider hover:bg-secondary transition-all active:scale-95"
              >
                Reload Trail
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="cursor-pointer w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-full border border-border hover:border-secondary text-fg-muted hover:text-fg font-semibold text-xs uppercase tracking-wider transition-colors"
              >
                Explore Campsites
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
