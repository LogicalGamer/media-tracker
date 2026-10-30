import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

// Inside the app, requests go through Tauri's HTTP plugin (made by Rust, so the
// browser's CORS rules don't apply). In a plain browser we use the normal fetch.
const doFetch: typeof fetch = (input, init) => (isTauri() ? tauriFetch(input, init) : fetch(input, init));

/** What went wrong, in a form the UI can turn into a friendly message. */
export type ApiErrorKind = "unauthorized" | "rate-limited" | "offline" | "unknown";

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
  ) {
    super(message);
  }
}

const MAX_RETRIES = 3;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends a request and parses the JSON reply. On HTTP 429 (too many requests) it
 * waits and tries again, doubling the wait each time (0.5s, 1s, 2s) — "exponential backoff".
 */
export async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, headers: { accept: "application/json", ...init.headers } });
    } catch {
      throw new ApiError("offline", "Can't reach the server. Check your internet connection.");
    }

    if (res.ok) return (await res.json()) as T;
    if (res.status === 401 || res.status === 403) {
      throw new ApiError("unauthorized", "The API key was rejected. Check it in Settings.");
    }
    if (res.status === 429) {
      if (attempt < MAX_RETRIES) {
        await wait(500 * 2 ** attempt);
        continue;
      }
      throw new ApiError("rate-limited", "Too many requests right now. Try again in a moment.");
    }
    throw new ApiError("unknown", `Something went wrong (HTTP ${res.status}).`);
  }
}

export const getJson = <T>(url: string, headers: Record<string, string> = {}) => requestJson<T>(url, { headers });

export const postJson = <T>(url: string, body: string, headers: Record<string, string> = {}) =>
  requestJson<T>(url, { method: "POST", body, headers });

/** Downloads a file (e.g. a cover image) as raw bytes. Returns null if it fails. */
export async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    const res = await doFetch(url);
    if (!res.ok) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" };
  } catch {
    return null;
  }
}
