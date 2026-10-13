import React from 'react';

export default class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("3D Layer Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#030005]/50 backdrop-blur-3xl">
          <p className="text-white/10 text-[9px] font-black uppercase tracking-[0.4em]">Visual Module Recovering...</p>
        </div>
      );
    }

    return this.props.children;
  }
}
