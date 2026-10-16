import React from 'react';
import Navbar from '../Navbar';
import AIAssistantDock from '../AIAssistantDock';
import CustomCursor from '../CustomCursor';
import SmoothScroll from '../SmoothScroll';

export default function AppLayout({ children }) {
  return (
    <SmoothScroll>
      <CustomCursor />
      {/* Skip to Main Content Link for Keyboard Accessibility (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-[99999] px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs uppercase tracking-wider shadow-2xl focus:ring-2 focus:ring-sky-400 focus:outline-none"
      >
        Skip to main content
      </a>

      <div className="min-h-screen bg-background text-fg selection:bg-secondary/30 flex flex-col justify-between">
        <Navbar />
        
        <main id="main-content" className="flex-1 w-full" tabIndex={-1}>
          {children}
        </main>

        <AIAssistantDock />
      </div>
    </SmoothScroll>
  );
}
