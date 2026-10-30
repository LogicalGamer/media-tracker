/// <reference types="vite/client" />

// Build-time settings read from .env.local (see .env.example)
interface ImportMetaEnv {
  readonly VITE_PROXY_URL?: string;
  readonly VITE_PROXY_KEY?: string;
}
