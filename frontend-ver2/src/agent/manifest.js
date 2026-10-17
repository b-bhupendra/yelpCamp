/**
 * UNIVERSAL AI CAPABILITY & NAVIGATION MANIFEST
 * Add any new page, modal, or button here once.
 * Automatically syncs to FastAPI + Turso Vector DB on startup.
 */
export const UI_CAPABILITY_MANIFEST = [
  {
    id: "upload_story",
    feature_name: "Upload Visitor Story",
    route: "/campgrounds",
    dom_selector: "#btn-upload-story",
    risk_level: "SAFE", // "SAFE" | "DRAFT" | "MUTATE"
    description: "Post a 24-hour campsite photo or visitor moment with caption and scenery tags.",
  },
  {
    id: "share_property",
    feature_name: "Share Campsite",
    route: "/campgrounds/:id",
    dom_selector: "#btn-share-property",
    risk_level: "SAFE",
    description: "Open the one-click share suite to copy direct link, share on WhatsApp, or generate dynamic QR code.",
  },
  {
    id: "add_campsite",
    feature_name: "Host New Campsite",
    route: "/campgrounds/new",
    dom_selector: "#btn-new-campground",
    risk_level: "DRAFT",
    description: "Create and list a new campground with multi-image gallery, amenities, pricing, and house rules.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Suggested title for the campground" },
        price: { type: "number", description: "Nightly price in USD" },
        location: { type: "string", description: "City, region, or mountain trail location" },
        description: { type: "string", description: "Atmospheric description of the campsite" },
        amenities: {
          type: "array",
          items: { type: "string" },
          description: "List of tags: tent_pitches, campfire, hot_showers, potable_water, wifi, pet_friendly, electricity"
        }
      }
    }
  },
  {
    id: "explore_campsites",
    feature_name: "Explore Trails & Campsites",
    route: "/campgrounds",
    dom_selector: "#nav-explore",
    risk_level: "SAFE",
    description: "Browse all curated campsites with pricing, rating filters, and location tags.",
  },
  {
    id: "user_dashboard",
    feature_name: "Personal Scout Dashboard",
    route: "/dashboard",
    dom_selector: "#nav-dashboard",
    risk_level: "SAFE",
    description: "View your hosted campgrounds, saved wishlist items, and total community likes.",
  },
  {
    id: "user_login",
    feature_name: "Sign In",
    route: "/login",
    dom_selector: "#nav-login",
    risk_level: "SAFE",
    description: "Navigate to the sign-in login portal with email or Google authentication.",
  },
  {
    id: "user_logout",
    feature_name: "Log Out",
    route: "/campgrounds",
    dom_selector: "#nav-logout-btn",
    risk_level: "MUTATE",
    description: "Terminate the active user session and sign out of YelpCamp.",
  },
  {
    id: "user_register",
    feature_name: "Join YelpCamp",
    route: "/register",
    dom_selector: "#nav-register",
    risk_level: "SAFE",
    description: "Create a new wilderness explorer account on YelpCamp.",
  }
];
