import React from 'react';

/**
 * CAMP HORIZON — a dark silhouette sitting at the foot of the first screen.
 *
 * It reads as the ridge line you'd be standing on: layered mountain ridges
 * and a pine tree line. Deliberately kept near-black and low-contrast so it
 * frames the scene and the 3D globe without competing with them.
 */

function Pine({ x, y, h, fill }) {
  const w = h * 0.6;
  return (
    <g transform={`translate(${x} ${y}) scale(${w / 64} ${h / 100})`} fill={fill}>
      <path d="M32 0 L54 36 H10 Z" />
      <path d="M32 24 L60 66 H4 Z" />
      <path d="M32 50 L66 96 H-2 Z" />
      <rect x="28.5" y="96" width="7" height="10" rx="1" />
    </g>
  );
}

export default function CampHorizon({ className = '' }) {
  return (
    <svg
      className={`camp-horizon ${className}`}
      viewBox="0 0 1440 420"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label="Silhouette of a mountain ridge with pine trees"
    >
      <defs>
        <linearGradient id="ch-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7cc0e6" stopOpacity="0" />
          <stop offset="100%" stopColor="#7cc0e6" stopOpacity="0.16" />
        </linearGradient>
      </defs>

      {/* Far ridge */}
      <path
        d="M0 236 L180 150 L330 214 L500 128 L690 224 L860 156 L1030 226 L1200 148 L1360 214 L1440 176 L1440 420 L0 420 Z"
        fill="#0a1727"
        opacity="0.85"
      />
      {/* Near ridge */}
      <path
        d="M0 300 L170 232 L350 292 L520 226 L700 296 L880 238 L1060 300 L1240 244 L1440 302 L1440 420 L0 420 Z"
        fill="#06101f"
      />
      {/* Mist band */}
      <rect x="0" y="196" width="1440" height="150" fill="url(#ch-mist)" />

      {/* Pine line */}
      <g>
        <Pine x={150} y={258} h={78} fill="#03080f" />
        <Pine x={214} y={272} h={60} fill="#03080f" />
        <Pine x={300} y={252} h={86} fill="#03080f" />
        <Pine x={368} y={270} h={62} fill="#03080f" />
        <Pine x={452} y={258} h={76} fill="#03080f" />
        <Pine x={1120} y={256} h={80} fill="#03080f" />
        <Pine x={1190} y={272} h={60} fill="#03080f" />
        <Pine x={1272} y={250} h={88} fill="#03080f" />
        <Pine x={1344} y={270} h={62} fill="#03080f" />
      </g>

      {/* Ground */}
      <path d="M0 316 C260 306 460 326 720 320 C980 314 1220 306 1440 318 L1440 420 L0 420 Z" fill="#03070e" />

    </svg>
  );
}
