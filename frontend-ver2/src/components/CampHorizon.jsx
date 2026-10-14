import React from 'react';

/**
 * CAMP HORIZON — An atmospheric silhouette at the foot of the first screen.
 * UI/UX Pro Max Edition
 *
 * Visual Elements:
 *   - Deep mountain ridge silhouettes layered with twilight mist
 *   - Pine tree tree-line
 *   - Cozy backcountry tent with warm glowing interior lantern light
 *   - Glowing campfire with animated flickering embers drifting upward
 *   - Soft horizon blur and ground mist
 */

function Pine({ x, y, h, fill }) {
  const w = h * 0.58;
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
    <div className={`relative w-full h-full ${className}`}>
      <svg
        className="w-full h-full block"
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
        role="img"
        aria-label="Silhouette of a mountain ridge with pine trees, glowing tent, and campfire"
      >
        <defs>
          {/* Mist Gradients */}
          <linearGradient id="ch-mist-1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.22" />
          </linearGradient>

          <linearGradient id="ch-mist-2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0" />
            <stop offset="100%" stopColor="#050a14" stopOpacity="0.8" />
          </linearGradient>

          {/* Tent Warm Glow Gradient */}
          <radialGradient id="tent-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffedd5" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#fbbf24" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#f97316" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </radialGradient>

          {/* Campfire Hearth Glow */}
          <radialGradient id="fire-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff7ed" stopOpacity="1" />
            <stop offset="25%" stopColor="#fb923c" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#ea580c" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </radialGradient>

          {/* Ambient Warm Hearth Wash */}
          <radialGradient id="hearth-wash" cx="50%" cy="80%" r="70%">
            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.26" />
            <stop offset="50%" stopColor="#fb923c" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── LAYER 1: Far Mountain Ridge ── */}
        <path
          d="M0 210 L140 140 L280 196 L460 115 L640 204 L820 138 L990 208 L1160 130 L1320 196 L1440 162 L1440 420 L0 420 Z"
          fill="#061224"
          opacity="0.88"
        />

        {/* ── LAYER 2: Mid Mountain Ridge ── */}
        <path
          d="M0 270 L160 205 L330 265 L500 198 L670 270 L850 210 L1020 274 L1200 215 L1380 278 L1440 252 L1440 420 L0 420 Z"
          fill="#040b17"
        />

        {/* ── Atmospheric Mist Bands ── */}
        <rect x="0" y="160" width="1440" height="180" fill="url(#ch-mist-1)" />
        <rect x="0" y="240" width="1440" height="160" fill="url(#ch-mist-2)" />

        {/* ── Pine Treeline (Left & Center Ridge) ── */}
        <g>
          <Pine x={60} y={242} h={65} fill="#02060c" />
          <Pine x={120} y={235} h={75} fill="#02060d" />
          <Pine x={180} y={250} h={58} fill="#02050b" />
          <Pine x={250} y={228} h={82} fill="#02060c" />
          <Pine x={315} y={245} h={64} fill="#02060d" />
          <Pine x={390} y={232} h={78} fill="#02050b" />
          <Pine x={470} y={248} h={60} fill="#02060c" />
          <Pine x={530} y={238} h={72} fill="#02060d" />
          <Pine x={610} y={252} h={55} fill="#02050b" />
        </g>

        {/* ── Right Treeline (Campsite Sanctuary) ── */}
        <g>
          <Pine x={950} y={240} h={68} fill="#02060c" />
          <Pine x={1010} y={228} h={84} fill="#02060d" />
          <Pine x={1075} y={245} h={62} fill="#02050b" />
          <Pine x={1220} y={232} h={86} fill="#02060c" />
          <Pine x={1290} y={248} h={68} fill="#02060d" />
          <Pine x={1360} y={236} h={80} fill="#02050b" />
        </g>

        {/* ── Ground Foreground Silhouette ── */}
        <path
          d="M0 295 C280 282 490 304 740 296 C1010 288 1230 280 1440 294 L1440 420 L0 420 Z"
          fill="#02050a"
        />

        {/* ── CAMPSITE HEARTH & TENT VIGNETTE (Centered at x: 1140, y: 285) ── */}
        <g className="campsite-vignette" transform="translate(1080, 240)">
          {/* Ambient Warm Light Dome */}
          <ellipse cx="60" cy="55" rx="140" ry="70" fill="url(#hearth-wash)" />

          {/* ── GLOWING BACKCOUNTRY TENT ── */}
          <g transform="translate(0, 10)">
            {/* Outer Tent Silhouette */}
            <path d="M0 45 L32 0 L64 45 Z" fill="#030812" />
            {/* Tent Guy-lines */}
            <line x1="32" y1="0" x2="-8" y2="46" stroke="#fbbf24" strokeWidth="0.8" strokeOpacity="0.4" />
            <line x1="32" y1="0" x2="72" y2="46" stroke="#fbbf24" strokeWidth="0.8" strokeOpacity="0.4" />
            {/* Illuminated Tent Inner Canvas (Pulsing warm glow) */}
            <polygon points="12,44 32,8 52,44" fill="url(#tent-glow)" opacity="0.92" className="ch-glow" />
            {/* Tent Vestibule / Door Shadow */}
            <polygon points="28,44 32,16 36,44" fill="#070d18" opacity="0.65" />
          </g>

          {/* ── CRACKLING CAMPFIRE HEARTH ── */}
          <g transform="translate(90, 36)">
            {/* Hearth Stones */}
            <ellipse cx="14" cy="18" rx="14" ry="5" fill="#010307" />
            {/* Campfire Flame Glow */}
            <circle cx="14" cy="14" r="28" fill="url(#fire-glow)" opacity="0.8" className="ch-glow" />
            {/* Flame Shapes */}
            <path
              d="M10 18 Q14 2 14 6 Q14 2 18 18 Q14 12 10 18 Z"
              fill="#fbbf24"
              className="ch-glow"
            />
            <path
              d="M12 18 Q14 8 15 11 Q15 8 16 18 Z"
              fill="#fff7ed"
            />
            {/* Floating Campfire Embers */}
            <circle cx="12" cy="6" r="1.2" fill="#fb923c" opacity="0.85" className="animate-ping" style={{ animationDuration: '2.5s' }} />
            <circle cx="16" cy="1" r="1" fill="#ea580c" opacity="0.9" className="animate-pulse" />
            <circle cx="13" cy="-5" r="0.8" fill="#fbbf24" opacity="0.75" />
          </g>
        </g>
      </svg>
    </div>
  );
}
