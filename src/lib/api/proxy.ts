// The shared server (Cloudflare Worker in /worker) that holds our API keys, so
// friends can search without creating their own. Its address and password come
// from `.env.local` at build time (see .env.example) and are built into the app.

export const PROXY =
  import.meta.env.VITE_PROXY_URL && import.meta.env.VITE_PROXY_KEY
    ? { url: import.meta.env.VITE_PROXY_URL.replace(/\/$/, ""), key: import.meta.env.VITE_PROXY_KEY }
    : null;

export const proxyHeaders = () => ({ "X-App-Key": PROXY!.key });
