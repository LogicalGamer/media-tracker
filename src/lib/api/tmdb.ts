import { getJson } from "@/lib/http";
import { PROXY, proxyHeaders } from "./proxy";
import { yearOf, type SearchResult } from "./types";

// TMDB docs: https://developer.themoviedb.org
const BASE = "https://api.themoviedb.org/3";

/**
 * GETs a TMDB path like "/search/movie?query=x". With the user's own token it
 * goes straight to TMDB; with no token it goes through our shared server.
 */
function tmdbGet<T>(path: string, token: string): Promise<T> {
  if (token) return getJson<T>(`${BASE}${path}`, { Authorization: `Bearer ${token}` });
  return getJson<T>(`${PROXY!.url}/tmdb/3${path}`, proxyHeaders());
}

type TmdbMovie = {
  id: number;
  title: string;
  release_date?: string;
  poster_path: string | null;
  genre_ids: number[];
};

// These two rarely change, so we fetch them once per app session and reuse them.
let imageBase: Promise<string> | null = null;
let genreNames: Promise<Map<number, string>> | null = null;

/** Base URL for posters, e.g. "https://image.tmdb.org/t/p/" (from /configuration). */
function getImageBase(token: string) {
  imageBase ??= tmdbGet<{ images: { secure_base_url: string } }>("/configuration", token)
    .then((c) => c.images.secure_base_url)
    .catch((e) => {
      imageBase = null; // don't cache a failure
      throw e;
    });
  return imageBase;
}

/** Search results only contain genre ids; this maps id -> name. */
function getGenres(token: string) {
  genreNames ??= tmdbGet<{ genres: { id: number; name: string }[] }>("/genre/movie/list", token)
    .then((r) => new Map(r.genres.map((g) => [g.id, g.name])))
    .catch((e) => {
      genreNames = null;
      throw e;
    });
  return genreNames;
}

/** `token` = the user's own TMDB token, or "" to use the shared server. */
export async function searchMovies(query: string, token: string): Promise<SearchResult[]> {
  const path = `/search/movie?include_adult=false&query=${encodeURIComponent(query)}`;
  const [data, base, genres] = await Promise.all([
    tmdbGet<{ results: TmdbMovie[] }>(path, token),
    getImageBase(token),
    getGenres(token),
  ]);
  return data.results.map((m) => ({
    source: "tmdb",
    externalId: String(m.id),
    type: "movie",
    title: m.title,
    year: yearOf(m.release_date),
    posterUrl: m.poster_path ? `${base}w342${m.poster_path}` : null,
    genres: m.genre_ids.map((id) => genres.get(id)).filter((g): g is string => !!g),
  }));
}

/** Throws an ApiError if the token doesn't work. */
export async function validateTmdbToken(token: string) {
  await getJson(`${BASE}/authentication`, { Authorization: `Bearer ${token}` });
}
