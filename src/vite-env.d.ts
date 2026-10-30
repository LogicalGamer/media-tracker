/// <reference types="vite/client" />

/** e.g. "1.0.0", filled in at build time (see vite.config.ts) */
declare const __APP_VERSION__: string;

// Build-time settings read from .env.local (see .env.example)
interface ImportMetaEnv {
  readonly VITE_PROXY_URL?: string;
  readonly VITE_PROXY_KEY?: string;
}
