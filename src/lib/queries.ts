import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";
import { addItem, listItems, removeItem, updateItem, type ItemChanges, type LibraryItem } from "@/lib/library";
import { searchMovies } from "@/lib/api/tmdb";
import { searchGames } from "@/lib/api/igdb";
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
  // own IGDB keys if entered, otherwise null = use the shared server
  const igdbCreds = hasOwnKeys("game", settings)
    ? { clientId: settings!.igdbClientId, clientSecret: settings!.igdbClientSecret }
    : null;
  return useQuery({
    queryKey: ["search", type, query],
    queryFn: () => (type === "movie" ? searchMovies(query, settings!.tmdbToken) : searchGames(query, igdbCreds)),
    enabled: hasKeysFor(type, settings) && query.trim().length >= 2,
    staleTime: 10 * 60 * 1000, // reuse the same search for 10 min instead of asking the API again
    retry: false, // requestJson already retries rate limits
  });
}

/** True when searching this media type is possible: own keys, or the shared server. */
export function hasKeysFor(type: MediaType, settings: Settings | undefined) {
  return !!settings && (PROXY !== null || hasOwnKeys(type, settings));
}

/** True when the user entered their own keys for this media type in Settings. */
function hasOwnKeys(type: MediaType, settings: Settings | undefined) {
  if (!settings) return false;
  return type === "movie" ? !!settings.tmdbToken : !!settings.igdbClientId && !!settings.igdbClientSecret;
}
