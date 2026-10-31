# Frontend Context (`FE_CONTEXT.md`) — YelpCamp `frontend-ver2`

> **Quick Summary**: YelpCamp `frontend-ver2` is a React 19 Single Page Application (SPA) built on Vite, Tailwind CSS v4, and Lucide/Feather icons. It features a dark-mode outdoor aesthetic with procedural 2D Canvas ambient sky effects, smooth scrolling (Lenis), magnetic cursor interactions, and a bidirectional Gemini-powered AI Co-Pilot with Dynamic UI State Machine actions.

---

## 1. Tech Stack & Environment

| Layer | Technology | Version / Details |
| :--- | :--- | :--- |
| **Framework** | React + React DOM | `^19.2.4` (JSX, Hooks, Suspense) |
| **Build Tool** | Vite | `^8.0.0` with `@vitejs/plugin-react` |
| **Routing** | React Router DOM | `^7.13.1` (BrowserRouter, Routes, Route, Navigate, lazy) |
| **Styling** | Tailwind CSS v4 | `@tailwindcss/vite` (`^4.2.1`), `index.css` design system |
| **Motion & Canvas** | Canvas 2D / Lenis / Framer Motion | Procedural Aurora Borealis, Lenis SmoothScroll (`^1.3.18`) |
| **HTTP Client** | Axios | `^1.13.6` with `withCredentials: true` and Bearer token interceptor |
| **UI Tours** | Driver.js | `^1.10.1` for AI-directed DOM element spotlighting |
| **Avatars** | DiceBear API | Fallback SVG adventurer avatars (`api.dicebear.com/7.x/adventurer`) |

---

## 2. Global React Contexts (`src/context/`)

The application state is powered by three top-level Context Providers wrapped in [App.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/App.jsx):

```text
GlobalErrorBoundary
 └── AuthProvider (AuthContext)
      └── ToastProvider (ToastContext)
           └── BrowserRouter
                └── AgentProvider (AgentContext)
                     └── AppLayout (Navbar + Outlet + AIAssistantDock)
```

### 2.1 AuthContext (`src/context/AuthContext.jsx`)
* **Purpose**: Manages authentication status, tokens, current user profile, and session persistence.
* **Storage Keys**:
  * `yelpcamp_token`: JWT string stored in `localStorage`.
  * `yelpcamp_user`: Serialized `{ id, username, avatar_url }` stored in `localStorage`.
* **State**:
  * `user`: `null` or `{ id, username, avatar_url }`.
  * `loading`: `boolean` (lazy initialized to true if token exists, false once `/api/me` returns).
* **Methods**:
  * `login(username, password)`: POSTs to `/api/login`, saves JWT, sets `user`.
  * `register(username, password)`: POSTs to `/api/register`, saves JWT, sets `user`.
  * `loginWithGoogle(credential)`: POSTs Google ID token to `/api/auth/google`.
  * `logout()`: Clears `localStorage` and resets `user` to `null`.
  * `checkAuth()`: Hits `GET /api/me` with Bearer token to validate active session.
  * `updateAvatar(avatarUrl)`: Updates avatar locally and synchronizes storage.
* **Session Expiry & 401 Interception**:
  * An Axios response interceptor in `api.js` catches `401 Unauthorized` responses from the backend.
  * Cleans up `yelpcamp_token` and `yelpcamp_user` immediately, dispatches an `auth:expired` event to reset `user` state to `null`, and triggers an accessible warning toast.
  * Protected routes (`/dashboard`, `/campgrounds/new`, `/campgrounds/:id/edit`) automatically redirect to `/login` with `state: { from: location }`, while public routes preserve the user's view in logged-out mode.
* **Usage**: `const { user, login, logout, register } = useAuth();`

---

### 2.2 AgentContext (`src/context/AgentContext.jsx`)
* **Purpose**: Coordinates AI Co-Pilot interactions, element navigation, tool calls, and Human-in-the-Loop approvals.
* **Core Concepts**:
  1. **Action Registry (`registeredActions`)**: Map of available tool IDs, metadata, risk levels, and JS callbacks.
  2. **UI Context State Machine (`uiContext`)**: Tracks what the user sees (`current_route`, `active_campground_id`, `active_campground_title`, `open_modal`, `draft_fields`).
  3. **Universal Capability Manifest (`manifest.js`)**: Static registry of all major DOM buttons, target routes, and actions.
  4. **Driver.js Spotlight Engine (`highlightElement`)**: Scrolls to and highlights DOM selectors requested by Gemini.
  5. **Cross-Route Deferred Execution**: If AI triggers an action on a page that isn't mounted yet, it navigates to that route first, waits for mount, and executes automatically.
  6. **Human-in-the-Loop (HITL) Gate (`pendingApproval`)**: Any action marked `risk_level: "MUTATE"` requires explicit user confirmation modal before running.
* **Usage**: `const { registerAction, updateUiContext, executeAction } = useAgent();`

---

### 2.3 ToastContext (`src/context/ToastContext.jsx`)
* **Purpose**: Lightweight, non-intrusive notification popups with accessible screen-reader cues (`aria-live="polite"`).
* **Toast Types**: `success` (emerald), `error` (rose), `warning` (amber), `info` (sky).
* **Methods**:
  * `toast.success(message, title)`
  * `toast.error(message, title)`
  * `toast.warning(message, title)`
  * `toast.info(message, title)`
* **Usage**: `const toast = useToast(); toast.success("Campground saved!");`

---

## 3. Custom Hooks (`src/hooks/`)

| Hook | File Path | Functionality |
| :--- | :--- | :--- |
| `useAuth` | [AuthContext.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/context/AuthContext.jsx) | Access authentication state and session methods |
| `useAgent` | [AgentContext.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/context/AgentContext.jsx) | Access UI context state and AI action registry |
| `useToast` | [ToastContext.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/context/ToastContext.jsx) | Trigger floating notification alerts |
| `useAgentAction` | [useAgentAction.js](file:///d:/Projects/yelpCamp/frontend-ver2/src/hooks/useAgentAction.js) | Registers a component's buttons/actions with AI; auto-unregisters on unmount |
| `useAgentChat` | [useAgentChat.js](file:///d:/Projects/yelpCamp/frontend-ver2/src/hooks/useAgentChat.js) | Message loop with FastAPI Gemini endpoint, handles function execution and highlights |
| `useAgentFormSync` | [useAgentFormSync.js](file:///d:/Projects/yelpCamp/frontend-ver2/src/hooks/useAgentFormSync.js) | Binds form values into `uiContext.draft_fields` & exposes `populate_form` action to AI |
| `useCampgrounds` | [useCampgrounds.js](file:///d:/Projects/yelpCamp/frontend-ver2/src/hooks/useCampgrounds.js) | SWR in-memory caching for 0ms skeleton revisits, immediate mount fetch, debounced search, pagination |
| `useVote` | [useVote.js](file:///d:/Projects/yelpCamp/frontend-ver2/src/hooks/useVote.js) | Handles upvoting/downvoting campsite reviews with optimistic score updates |
| `useWishlist` | [useWishlist.js](file:///d:/Projects/yelpCamp/frontend-ver2/src/hooks/useWishlist.js) | Bookmark campsites with optimistic toggling and backend sync |

---

## 4. Route Architecture & Component Map

| URL Path | Component | Description |
| :--- | :--- | :--- |
| `/` | [Landing.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/pages/Landing.jsx) | Immersive landing with Canvas Aurora Borealis, CampHorizon silhouette, and Bento grid |
| `/campgrounds` | [CampgroundList.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/pages/CampgroundList.jsx) | Explorer catalog with instant search, story avatars bar, and pricing/tag filters |
| `/campgrounds/:id` | [CampgroundDetails.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/pages/CampgroundDetails.jsx) | Campground detail view: image gallery, amenities, location, sharing suite, threaded reviews |
| `/campgrounds/new` | [NewCampground.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/pages/NewCampground.jsx) | Campground submission form with AI auto-fill capability |
| `/campgrounds/:id/edit` | [EditCampground.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/pages/EditCampground.jsx) | Edit campsite details (restricted to author) |
| `/dashboard` | [Dashboard.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/pages/Dashboard.jsx) | User dashboard with hosted campsites, wishlist items, uploaded story moments, and avatar uploader |
| `/login` | [Login.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/pages/Login.jsx) | User authentication via username/password or Google OAuth |
| `/register` | [Register.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/pages/Register.jsx) | Scout account registration with automatic session creation |
| `*` | [NotFound.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/pages/NotFound.jsx) | 404 trail error view with quick return to exploration |

---

## 5. Shell & UI Components Architecture (`src/components/`)

* **[AppLayout.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/layout/AppLayout.jsx)**: Persistent application wrapper providing:
  * Accessible skip-to-content anchor (`#main-content`).
  * [SmoothScroll.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/SmoothScroll.jsx) using Lenis.
  * [CustomCursor.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/CustomCursor.jsx) for magnetic pointer following.
  * [Navbar.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/Navbar.jsx) with scroll-aware blur header and mobile drawer.
  * [AIAssistantDock.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/AIAssistantDock.jsx) slide-out floating copilot dock.
* **[Navbar.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/Navbar.jsx)**:
  * Fixed nav with dynamic scroll opacity & blur.
  * Includes "AI Search" button that opens the AI Assistant in search mode.
  * Auth-responsive (renders Avatar + Dashboard + Logout if signed in, Login + Join if guest).
* **[AIAssistantDock.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/AIAssistantDock.jsx)**:
  * Floating bottom-right action trigger.
  * Dual-mode: Semantic Vector Search & Interactive Conversational Co-Pilot.
* **[AmbientAtmosphere.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/AmbientAtmosphere.jsx)**:
  * High-performance Canvas 2D engine running Aurora Borealis waves, star twinkles, and meteor trails.
  * Respects `prefers-reduced-motion` and pauses when tab is hidden.
* **[CampHorizon.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/CampHorizon.jsx)**:
  * Vector mountain ridge silhouette, glowing backcountry tent, and campfire ember animations.
* **Stories Subsystem (`src/components/stories/`)**:
  * [StoryBar.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/stories/StoryBar.jsx): 24h Instagram-style avatar circles with viewed/unread ring states.
  * [StoryUploadModal.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/stories/StoryUploadModal.jsx): Image upload, captioning, and tags.
  * [StoryViewerModal.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/stories/StoryViewerModal.jsx): Touch/keyboard story carousel with auto-advancing progress bars.
* **Comments Subsystem (`src/components/comments/`)**:
  * [ThreadedComments.jsx](file:///d:/Projects/yelpCamp/frontend-ver2/src/components/comments/ThreadedComments.jsx): Nested community reviews, upvoting/downvoting, verified camper status.

---

## 6. Styling & Design Tokens (`src/index.css`)

The app uses Tailwind CSS v4 design tokens defining a nature-inspired dark palette:
* `bg-background`: `#030712` (Midnight wilderness black)
* `bg-surface`: `#0a1120` (Deep alpine blue-gray)
* `border-border`: `#1e293b` (Subtle boundary lines)
* `text-fg`: `#f8fafc` (High contrast pure white/frost text)
* `text-fg-muted`: `#94a3b8` (Secondary text)
* `text-primary`: `#0ea5e9` (Vibrant cyan/sky accent)
* `text-secondary`: `#38bdf8` (Ice sky highlight)
* `text-accent`: `#f59e0b` (Campfire amber)
* `text-destructive`: `#f43f5e` (Rose red warning)
