# Implementation Plan: Property Hosting & Sharing with Instagram-Style Visitor Stories

## Goal Description
Extend YelpCamp to allow:
1. **Property Sharing & Rich Hosting**: Any registered user can list, manage, and share their outdoor properties with a multi-image gallery, structured amenities, address details, and a one-click share suite (Direct Link, WhatsApp, X/Twitter, QR Code).
2. **Visitor Photos & Instagram-Style Stories ("Visitor Moments")**: Visitors can upload photos from their visits. On campsite pages and the homepage, visitor profile pictures (DPs) appear with interactive story rings; clicking opens an immersive full-screen story viewer with auto-advancing progress bars, captions, and like reactions.
3. **Gemini Vision AI Auto-Tagging**: Uploaded visitor photos are automatically analyzed by Gemini 3.5 Flash for ambiance tags and descriptive captions, feeding into semantic vector search.

---

## Architecture & Data Model

### 1. Database Schema Updates ([`backend/models.py`](file:///d:/Projects/yelpCamp/backend/models.py))

#### `Campground` Model Extension:
- `gallery_images`: JSON list of image URLs (or secondary table `CampgroundImage`).
- `amenities`: JSON list of tags (`["wifi", "campfire", "pets_allowed", "showers", "drinking_water", "electricity"]`).
- `location_address`: Formatted address or region string.
- `rules`: Check-in rules, max guests, tent capacity.

#### New `VisitorPhoto` Model:
```python
class VisitorPhoto(SQLModel, table=True):
    __tablename__ = "visitor_photos"
    id: Optional[int] = Field(default=None, primary_key=True)
    campground_id: int = Field(foreign_key="campground.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    user_username: str
    user_avatar: Optional[str] = Field(default=None)
    image_url: str
    caption: Optional[str] = Field(default="")
    ai_tags: str = Field(default="[]")  # JSON list of tags e.g. ["campfire", "sunset", "lake"]
    likes_count: int = Field(default=0)
    created_at: str = Field(default="")  # ISO format string
    
    # Relationships
    campground: Optional["Campground"] = Relationship(back_populates="visitor_photos")
    user: Optional["User"] = Relationship(back_populates="visitor_photos")
```

#### New `VisitorPhotoLike` Model:
Tracks user likes on visitor photos to prevent duplicate voting:
- `user_id`: Composite primary key (foreign key to `user.id`).
- `photo_id`: Composite primary key (foreign key to `visitor_photos.id`).

---

## Backend Implementation Plan

### 1. Photo Upload & Gemini Vision Service ([`backend/services/vision_service.py`](file:///d:/Projects/yelpCamp/backend/services/vision_service.py))
- Integrates with `google-genai` and Cloudinary.
- When an image is uploaded:
  1. Uploads image to Cloudinary (or accepts image URL).
  2. Calls `gemini-3.5-flash` with the image bytes to extract:
     - Atmospheric 1-sentence caption suggestion.
     - 4-6 scenic tags (e.g., `["stargazing", "clearing", "lakefront", "hammock"]`).
  3. Returns optimized URL, caption, and tags.

### 2. New Visitor Photos Router ([`backend/routers/visitor_photos.py`](file:///d:/Projects/yelpCamp/backend/routers/visitor_photos.py))
- `GET /api/campgrounds/{id}/stories`: Returns visitor stories grouped by user (avatar, username, photos array, latest timestamp).
- `POST /api/campgrounds/{id}/photos`: Uploads a visitor photo with optional caption and Gemini AI auto-tagging.
- `POST /api/photos/{photo_id}/like`: Toggles like on a visitor photo.
- `DELETE /api/photos/{photo_id}`: Allows the author (or property host) to delete a photo.
- `GET /api/stories/explore`: Returns top trending explorer stories across all campgrounds for the Home/Explore page carousel.

### 3. Campground Extension & Sharing Endpoints ([`backend/routers/campgrounds.py`](file:///d:/Projects/yelpCamp/backend/routers/campgrounds.py))
- Support `amenities` and `gallery_images` in `CampgroundCreate` and `CampgroundUpdate` schemas.
- Update `/api/campgrounds/{id}` to return amenities, gallery images, and visitor photos count.

---

## Frontend Implementation Plan (`frontend-ver2`)

### 1. Instagram-Style Story Ring Bar (`StoryBar.jsx` & `StoryViewerModal.jsx`)
- **Visual Design**:
  - Horizontal scrollable row of visitor avatar rings with YelpCamp green-to-cyan gradient borders (`#10b981` $\rightarrow$ `#06b6d4`).
  - Active/unseen gradient ring, dim ring for viewed stories.
  - First circle is a `+ Add Your Story` button for logged-in visitors.
- **Story Viewer Modal**:
  - Full-screen or modal backdrop with Instagram/Snapchat-style segmented top progress bars (one bar per photo in the user's batch, 5s timer per slide).
  - Tap left/right or arrow keys to navigate photos within a user's story or advance to the next user.
  - Header: Visitor avatar, username, time ago, and close button.
  - Bottom overlay: Photo caption, Gemini AI scenery badges, like heart button with animated count.

### 2. Rich Property Creation & Edit Modal (`NewCampground.jsx` / `EditCampground.jsx`)
- Multi-photo uploader with drag-and-drop preview cards.
- Interactive amenities picker:
  - 🏕️ Tent Pitches / RV Hookup
  - 🔥 Campfire Allowed
  - 🚿 Hot Showers
  - 💧 Potable Water
  - 📶 High-Speed WiFi
  - 🐾 Pet-Friendly
  - ⚡ Electricity
- Location/address input with map preview.

### 3. One-Click Property Share Suite (`SharePropertyModal.jsx`)
- Added to `CampgroundDetails.jsx` as a prominent `Share Property` button with icon.
- Features:
  - **Direct Link**: One-click "Copy Link" with instant visual confirmation ("Copied to clipboard!").
  - **Social Sharing**: Direct share links for WhatsApp, X (Twitter), Facebook, and Telegram.
  - **Dynamic QR Code**: Rendered in-app with canvas for easy mobile scanning by friends on camping trips.
  - **Open Graph Preview**: Card showing how the preview appears in chat apps.

### 4. Placements & Integration
- **Campground Details (`CampgroundDetails.jsx`)**:
  - Visitor Stories Bar placed directly above the gallery and reviews.
  - Multi-photo masonry / carousel gallery for host property photos.
  - Amenities badges section.
- **Home / Explorer Page (`Landing.jsx` / `CampgroundList.jsx`)**:
  - Top "Recent Explorer Moments" story carousel showing active visitor stories across popular campsites.
- **User Dashboard (`Dashboard.jsx`)**:
  - Added "My Properties" tab (host view) and "My Uploaded Moments" tab (visitor view).

---

## Verification & Testing Plan

### 1. API Verification
- `POST /api/campgrounds/{id}/photos`: Verify multipart file upload, Cloudinary persistence, and Gemini Vision AI tag generation.
- `GET /api/campgrounds/{id}/stories`: Verify correct grouping of stories by user ID with timestamps.
- `POST /api/photos/{id}/like`: Verify idempotent toggle liking.

### 2. Browser & UI Testing (Chrome DevTools / Visual Verification)
- Test property creation with multiple images and amenities.
- Verify story ring animations, story viewer auto-advancing progress bars, and mobile responsiveness.
- Test one-click share modal and QR code generation.
- Verify production deployment to Cloud Run and Vercel.
