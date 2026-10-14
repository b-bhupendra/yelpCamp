# YelpCamp — Aurora Design System

Source of truth for the visual system applied to the YelpCamp front end.
Derived with the **UI UX Pro Max** skill (`--design-system`), then adapted to a
dark, cinematic product.

## Where this came from

Running the skill's design-system generator for the product:

```
python .claude/skills/ui-ux-pro-max/scripts/search.py \
  "campground travel booking outdoor marketplace adventure" \
  --design-system -p "YelpCamp"
```

returned:

| Axis | Recommendation |
|------|----------------|
| **Style** | Aurora UI — *vibrant gradients, smooth blend, northern-lights effect, mesh gradient, luminous, atmospheric* (light **and** dark supported) |
| **Palette** | Travel / Tourism — sky blue primary, adventure-orange accent |
| **Pattern** | Scroll-triggered storytelling (hero → chapters → climax CTA) |
| **Effects** | Large flowing gradients, subtle 8–12s animations, depth via colour layering |
| **Avoid** | Generic stock photos as the only content; over-complex booking flows |

We keep the product's dark, immersive character and use the **dark-mode
adaptation** of Aurora UI — the style the skill lists as dark-supported.

## Colour tokens

Three layers: primitive → semantic → component (all in `src/index.css`).

### Primitive
`sky-300 #67e8f9` · `sky-400 #38bdf8` · `sky-500 #0ea5e9` · `orange-500 #ea580c`
`amber-400 #fbbf24` · `ink-950 #050a14` · `ink-900 #0a1220` · `ink-800 #101b2e`

### Semantic (Tailwind v4 `@theme`, usable as `bg-*` / `text-*` / `border-*`)
| Token | Value | Contrast on `background` |
|-------|-------|--------------------------|
| `background` | `#050a14` | — |
| `surface` / `surface-2` / `elevated` | `#0a1220` / `#101b2e` / `#16233a` | — |
| `fg` | `#eaf2fb` | 17.5 : 1 |
| `fg-muted` | `#9fb3c8` | 9.2 : 1 |
| `fg-subtle` | `#7c93ab` | 6.2 : 1 |
| `fg-faint` | `#5a7189` | 3.9 : 1 — **decorative only** |
| `primary` | `#0ea5e9` | 7.2 : 1 |
| `secondary` | `#38bdf8` | 9.3 : 1 |
| `accent` | `#ea580c` | 5.6 : 1 |
| `accent-2` | `#fbbf24` | 11.9 : 1 |
| `destructive` | `#f87171` | 7.2 : 1 |
| `border` / `border-strong` | `#1e3049` / `#2b4568` | — |
| `ring` | `#38bdf8` | — |

Every text token clears **4.5 : 1** on every surface. Buttons use
`on-primary #04121f` (6.8 : 1 on primary) and `on-accent #1a0a02` (5.4 : 1 on accent),
because white on those accents does **not** pass.

### Radius scale
`sm .5rem · md .75rem · lg 1rem · xl 1.5rem · 2xl 2rem · 3xl 2.5rem` — no ad-hoc radii.

## Typography
- Display: **Outfit** (700–900) — headlines only.
- Body: **Plus Jakarta Sans** — everything else.
- Minimum body/label size is **12px**; body base 16px; line-height 1.5.

## What changed from the previous build

| Area | Before | After |
|------|--------|-------|
| Accent | muddy indigo `#818cf8` + purple, plus stray pink/orange gradients | one coherent aurora system: sky blue → cyan → adventure orange |
| Icons | emoji & glyphs (`🚀 💎 ⚡ 🤝 ❖ ❝ ▲ ▼`) | a single inline SVG family (`src/components/Icons.jsx`) |
| Text contrast | content at `white/10 … white/30` (≈1.5–3 : 1) | semantic tokens, all ≥ 4.5 : 1 |
| Type size | labels at 8–10px, tracking up to `1em` | labels ≥ 12px, tracking ≤ `0.3em` |
| Cursor | system cursor hidden (`cursor: none`) | system cursor kept; custom ring is additive, fine-pointer + motion-safe only |
| Focus | none (outline removed) | global `:focus-visible` ring on every control |
| Motion | always-on (Lenis, parallax, tilt, 3D) | `prefers-reduced-motion` respected everywhere; canvas pauses when hidden |
| Backgrounds | 5 different near-black hexes | one `background` token |
| Radii | `2xl 3xl [2rem] [2.5rem] [3rem] [4rem] full` | one radius scale |

## Accessibility notes
- `prefers-reduced-motion: reduce` neutralises decorative motion and renders each
  element in its final readable state.
- The ambient canvas and the 3D hero pause when the tab is hidden.
- The 3D hero is wrapped in an error boundary so a missing WebGL context degrades
  to a static frame instead of throwing.
- Form fields have associated `<label>`s; error messages use `role="alert"`;
  vote buttons expose `aria-pressed`; decorative icons are `aria-hidden`.
