import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";
import {
  addItem,
  listItems,
  removeItem,
  saveDetails,
  updateItem,
  type ItemChanges,
  type LibraryItem,
} from "@/lib/library";
import { ApiError } from "@/lib/http";
import { getMovieDetails, searchMovies } from "@/lib/api/tmdb";
import { getGameDevelopers, searchGames, type IgdbCredentials } from "@/lib/api/igdb";
import { PROXY } from "@/lib/api/proxy";
import type { MediaType, SearchResult } from "@/lib/api/types";

// TanStack Query hooks: they cache results, track loading/error states and
// refresh data automatically when something changes it.

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: getSettings });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<Settings>) => saveSettings(changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useLibrary(type: MediaType) {
  return useQuery({ queryKey: ["library", type], queryFn: () => listItems(type) });
}

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (result: SearchResult) => addItem(result),
    // refetch the library so the new item shows up
    onSuccess: (_, result) => qc.invalidateQueries({ queryKey: ["library", result.type] }),
  });
}

/**
 * Saves edits to one item. The cached library is updated right away
 * ("optimistic update") so the UI feels instant; if saving fails we roll back.
 */
export function useUpdateItem(type: MediaType) {
  const qc = useQueryClient();
  const key = ["library", type];
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: ItemChanges }) => updateItem(id, changes),
    onMutate: async ({ id, changes }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<LibraryItem[]>(key);
      qc.setQueryData<LibraryItem[]>(key, (items) => items?.map((i) => (i.id === id ? { ...i, ...changes } : i)));
      return { previous };
    },
    onError: (_err, _vars, context) => qc.setQueryData(key, context?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useRemoveItem(type: MediaType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => removeItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", type] }),
  });
}

/**
 * Searches TMDB (movies) or IGDB (games). Uses the user's own keys when they're
 * set, otherwise the shared server. Needs at least 2 characters.
 */
export function useSearch(type: MediaType, query: string, settings: Settings | undefined) {
  return useQuery({
    queryKey: ["search", type, query],
    queryFn: () =>
      type === "movie" ? searchMovies(query, settings!.tmdbToken) : searchGames(query, igdbCredentials(settings)),
    enabled: hasKeysFor(type, settings) && query.trim().length >= 2,
    staleTime: 10 * 60 * 1000, // reuse the same search for 10 min instead of asking the API again
    retry: false, // requestJson already retries rate limits
  });
}

// TMDB's terms ask apps not to keep cached data longer than 6 months.
const SIX_MONTHS = 182 * 24 * 60 * 60 * 1000;

/**
 * True when an item needs downloading again: its directors/composers (movies)
 * or developers (games) were never looked up, or it's a movie whose TMDB data
 * is older than 6 months.
 */
export const needsDetails = (item: LibraryItem) =>
  item.type === "movie"
    ? item.extra.directors === undefined || Date.now() - Date.parse(item.fetchedAt) > SIX_MONTHS
    : item.extra.developers === undefined;

/**
 * Downloads details for the items that need them (see needsDetails): movies
 * right after being added, items saved before the filters existed, and movies
 * due for their 6-month refresh. Runs in the background while the library is open. It uses useQuery only so
 * the same batch isn't fetched twice; it returns nothing useful itself.
 */
export function useFillDetails(type: MediaType, items: LibraryItem[] | undefined, settings: Settings | undefined) {
  const qc = useQueryClient();
  const missing = items?.filter(needsDetails) ?? [];
  return useQuery({
    queryKey: ["fill-details", type, missing.map((i) => i.id).join(",")],
    enabled: missing.length > 0 && hasKeysFor(type, settings),
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (type === "movie") {
        for (const item of missing) {
          // one at a time with a short pause, to stay well under the shared server's per-minute limit
          await new Promise((r) => setTimeout(r, 200));
          try {
            await saveDetails(item, await getMovieDetails(item.externalId, settings!.tmdbToken));
          } catch (e) {
            // "unknown" = e.g. the movie was removed from TMDB: skip it. Anything else
            // (offline, bad key, rate limit) would fail for every movie, so stop.
            if (!(e instanceof ApiError && e.kind === "unknown")) throw e;
          }
        }
      } else {
        const developers = await getGameDevelopers(missing.map((i) => i.externalId), igdbCredentials(settings));
        for (const item of missing) await saveDetails(item, { developers: developers.get(item.externalId) ?? [] });
      }
      await qc.invalidateQueries({ queryKey: ["library", type] });
      return true;
    },
  });
}

/** True when searching this media type is possible: own keys, or the shared server. */
export function hasKeysFor(type: MediaType, settings: Settings | undefined) {
  return !!settings && (PROXY !== null || hasOwnKeys(type, settings));
}

/** The user's own IGDB keys, or null to use the shared server. */
function igdbCredentials(settings: Settings | undefined): IgdbCredentials | null {
  return hasOwnKeys("game", settings) ? { clientId: settings!.igdbClientId, clientSecret: settings!.igdbClientSecret } : null;
}

/** True when the user entered their own keys for this media type in Settings. */
function hasOwnKeys(type: MediaType, settings: Settings | undefined) {
  if (!settings) return false;
  return type === "movie" ? !!settings.tmdbToken : !!settings.igdbClientId && !!settings.igdbClientSecret;
}
