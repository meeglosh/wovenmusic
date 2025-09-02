// src/lib/config.ts
// Centralized, browser-safe config (no service_role key here).

type ViteEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_APP_API_BASE?: string;     // optional: external API base; usually empty for same-origin
  VITE_PUBLIC_BASE_URL?: string;  // optional: e.g. https://wovenmusic.app
};

const V = (import.meta as any)?.env as ViteEnv | undefined;

function detectBaseUrl(): string {
  // 1) explicit build-time override
  if (V?.VITE_PUBLIC_BASE_URL) return V.VITE_PUBLIC_BASE_URL.replace(/\/+$/, "");
  // 2) window-provided override OR fall back to location.origin
  if (typeof window !== "undefined") {
    const w = window as any;
    const fromWindow = w.__APP_BASE_URL__ || `${location.protocol}//${location.host}`;
    return String(fromWindow).replace(/\/+$/, "");
  }
  // 3) server-side render / build default
  return "https://wovenmusic.app";
}

// Public, build-time config. Safe to ship to the browser.
export const CONFIG = {
  BASE_URL: detectBaseUrl(),

  // Supabase client config (browser uses anon key only):
  SUPABASE_URL: (V?.VITE_SUPABASE_URL || "").replace(/\/+$/, ""),
  SUPABASE_ANON_KEY: V?.VITE_SUPABASE_ANON_KEY || "",

  // When blank, your frontend will call same-origin CF Pages Functions (recommended)
  API_BASE: (V?.VITE_APP_API_BASE || "").replace(/\/+$/, ""),

  // Canonical CDN for public images
  IMAGES_CDN_BASE: "https://images.wovenmusic.app",
} as const;

// Join URL parts without duplicating slashes
export const joinUrl = (...parts: string[]) =>
  parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, "") : p.replace(/^\/+|\/+$/g, "")))
    .join("/");

// Helper functions for URL generation
export const generatePlaylistUrl = (shareToken: string, playlistId?: string) => {
  return shareToken
    ? `${CONFIG.BASE_URL}/?playlist=${encodeURIComponent(shareToken)}`
    : `${CONFIG.BASE_URL}/playlist/${encodeURIComponent(playlistId || "")}`;
};

export const generatePlaylistShareUrl = (shareToken: string, playlistId?: string) => {
  return shareToken
    ? `${CONFIG.BASE_URL}/playlist/shared?token=${encodeURIComponent(shareToken)}`
    : `${CONFIG.BASE_URL}/playlist/${encodeURIComponent(playlistId || "")}`;
};

export const generateCommentUrl = (shareToken: string) => {
  return `${CONFIG.BASE_URL}/?playlist=${encodeURIComponent(shareToken)}#comments`;
};

export const generateAuthUrl = (token: string) => {
  return `${CONFIG.BASE_URL}/auth?token=${encodeURIComponent(token)}`;
};
