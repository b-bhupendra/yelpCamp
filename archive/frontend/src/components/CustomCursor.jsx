import React, { useEffect, useState } from 'react';

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [clicked, setClicked] = useState(false);
  const [linkHovered, setLinkHovered] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const addEventListeners = () => {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseenter", onMouseEnter);
      document.addEventListener("mouseleave", onMouseLeave);
      document.addEventListener("mousedown", onMouseDown);
      document.addEventListener("mouseup", onMouseUp);
    };

    const removeEventListeners = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseenter", onMouseEnter);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setHidden(false);
    };

    const onMouseEnter = () => setHidden(false);
    const onMouseLeave = () => setHidden(true);
    const onMouseDown = () => setClicked(true);
    const onMouseUp = () => setClicked(false);

    const handleLinkHover = () => {
      const links = document.querySelectorAll('a, button, [role="button"]');
      links.forEach(link => {
        link.addEventListener('mouseenter', () => setLinkHovered(true));
        link.addEventListener('mouseleave', () => setLinkHovered(false));
      });
    };

    addEventListeners();
    handleLinkHover();

    // Re-check for links periodically (in case of dynamic mounting)
    const interval = setInterval(handleLinkHover, 2000);

    return () => {
      removeEventListeners();
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <div
        className={`fixed top-0 left-0 w-8 h-8 rounded-full pointer-events-none z-[9999] mix-blend-difference transition-transform duration-300 ease-out flex items-center justify-center ${
          hidden ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%) scale(${
            clicked ? 0.8 : linkHovered ? 2.5 : 1
          })`,
          background: 'white'
        }}
      >
        {linkHovered && (
          <div className="w-1 h-1 bg-[#030005] rounded-full"></div>
        )}
      </div>
      
      {/* Soft Glow Trail */}
      <div
        className={`fixed top-0 left-0 w-64 h-64 rounded-full pointer-events-none z-[9998] transition-opacity duration-500 blur-[80px] ${
          hidden ? 'opacity-0' : 'opacity-20'
        }`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
          background: 'radial-gradient(circle, rgba(129, 140, 248, 0.4) 0%, transparent 70%)'
        }}
      ></div>
    </>
  );
}
