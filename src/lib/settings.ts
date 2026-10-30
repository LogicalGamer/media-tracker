import { isTauri } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";

// User settings saved on this device only (never in the repo).
// Inside the app they live in a JSON file in the app's data folder (Tauri Store
// plugin). In a plain browser (`npm run dev`) we fall back to localStorage.

export type Settings = {
  tmdbToken: string; // TMDB "API Read Access Token"
  igdbClientId: string; // IGDB (Twitch) Client ID
  igdbClientSecret: string; // IGDB (Twitch) Client Secret
};

const DEFAULTS: Settings = { tmdbToken: "", igdbClientId: "", igdbClientSecret: "" };
const STORE_FILE = "settings.json";

export async function getSettings(): Promise<Settings> {
  if (!isTauri()) {
    const saved = localStorage.getItem(STORE_FILE);
    return { ...DEFAULTS, ...(saved ? JSON.parse(saved) : {}) };
  }
  const store = await load(STORE_FILE);
  return {
    tmdbToken: (await store.get<string>("tmdbToken")) ?? "",
    igdbClientId: (await store.get<string>("igdbClientId")) ?? "",
    igdbClientSecret: (await store.get<string>("igdbClientSecret")) ?? "",
  };
}

export async function saveSettings(changes: Partial<Settings>): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(STORE_FILE, JSON.stringify({ ...(await getSettings()), ...changes }));
    return;
  }
  const store = await load(STORE_FILE);
  for (const [key, value] of Object.entries(changes)) await store.set(key, value);
  await store.save();
}
