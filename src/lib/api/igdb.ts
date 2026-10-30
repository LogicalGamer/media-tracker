import { ApiError, postJson } from "@/lib/http";
import { PROXY, proxyHeaders } from "./proxy";
import type { SearchResult } from "./types";

// IGDB docs: https://api-docs.igdb.com  (free for non-commercial use, ~4 requests/second)
// Auth is a two-step process through Twitch:
//   1. trade the Client ID + Client Secret for an access token (valid ~60 days)
//   2. send Client-ID + "Bearer <token>" with every IGDB request
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const BASE = "https://api.igdb.com/v4";
const COVER_URL = "https://images.igdb.com/igdb/image/upload/t_cover_big";

export type IgdbCredentials = { clientId: string; clientSecret: string };

type IgdbGame = {
  id: number;
  name: string;
  first_release_date?: number; // unix timestamp (seconds)
  cover?: { image_id: string };
  genres?: { name: string }[];
  platforms?: { name: string; abbreviation?: string }[];
  involved_companies?: { developer: boolean; company: { name: string } }[];
  total_rating_count?: number; // how many people rated it: a good sign of a real, known game
};

// IGDB "game types" worth showing: main game, expansion, standalone expansion,
// remake, remaster, expanded game. Leaves out DLC, bundles, mods, seasons, ports...
const GAME_TYPES = "(0,2,4,8,9,10)";

/** The studios that made the game (IGDB also lists publishers, porting studios, ...). */
const developersOf = (g: IgdbGame) =>
  g.involved_companies?.filter((c) => c.developer).map((c) => c.company.name) ?? [];

/** With own keys: straight to IGDB. Without (null): through our shared server. */
const runQuery = <T>(body: string, creds: IgdbCredentials | null) =>
  creds ? igdbQuery<T>("games", body, creds) : postJson<T>(`${PROXY!.url}/igdb/games`, body, proxyHeaders());

// The token is kept in memory and reused until it's about to expire.
// Getting a new one is a single cheap request, so we don't bother saving it to disk.
let cached: { clientId: string; token: string; expiresAt: number } | null = null;

async function getToken({ clientId, clientSecret }: IgdbCredentials, forceNew = false): Promise<string> {
  if (!forceNew && cached?.clientId === clientId && Date.now() < cached.expiresAt) return cached.token;

  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" });
  try {
    const res = await postJson<{ access_token: string; expires_in: number }>(`${TOKEN_URL}?${params}`, "");
    // expires_in is in seconds; renew a minute early to be safe
    cached = { clientId, token: res.access_token, expiresAt: Date.now() + (res.expires_in - 60) * 1000 };
    return res.access_token;
  } catch (e) {
    // Twitch answers 400/403 for a wrong ID or secret: show that as a key problem
    if (e instanceof ApiError && (e.kind === "unknown" || e.kind === "unauthorized")) {
      throw new ApiError("unauthorized", "The IGDB Client ID or Secret was rejected. Check them in Settings.");
    }
    throw e;
  }
}

/** Sends an IGDB query. If the token has expired early, gets a fresh one and tries once more. */
async function igdbQuery<T>(endpoint: string, query: string, creds: IgdbCredentials): Promise<T> {
  const send = async (token: string) =>
    postJson<T>(`${BASE}/${endpoint}`, query, { "Client-ID": creds.clientId, Authorization: `Bearer ${token}` });
  const token = await getToken(creds); // outside the try: bad credentials shouldn't trigger the retry
  try {
    return await send(token);
  } catch (e) {
    if (e instanceof ApiError && e.kind === "unauthorized") return send(await getToken(creds, true));
    throw e;
  }
}

/** `creds` = the user's own IGDB keys, or null to use the shared server. */
export async function searchGames(query: string, creds: IgdbCredentials | null): Promise<SearchResult[]> {
  // IGDB uses its own query language ("Apicalypse"). Quotes in the search text must be escaped.
  // `version_parent = null` hides duplicate editions (GOTY, Deluxe, ...).
  const q = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const body = `search "${q}";
     fields name, first_release_date, cover.image_id, genres.name, platforms.name, platforms.abbreviation,
            involved_companies.developer, involved_companies.company.name, total_rating_count;
     where version_parent = null & game_type = ${GAME_TYPES};
     limit 30;`;
  const games = await runQuery<IgdbGame[]>(body, creds);
  // Most-rated first: well-known games rise to the top and fan-made projects sink.
  // (sort is stable, so games with equal counts keep IGDB's relevance order)
  games.sort((a, b) => (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0));
  return games.map((g) => ({
    source: "igdb",
    externalId: String(g.id),
    type: "game",
    title: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
    posterUrl: g.cover ? `${COVER_URL}/${g.cover.image_id}.jpg` : null,
    genres: g.genres?.map((x) => x.name) ?? [],
    platforms: g.platforms?.map((p) => p.abbreviation ?? p.name) ?? [],
    developers: developersOf(g),
  }));
}

/** Developers for several saved games in one request (IGDB allows ~4 requests/second). Keyed by game id. */
export async function getGameDevelopers(ids: string[], creds: IgdbCredentials | null): Promise<Map<string, string[]>> {
  const body = `fields involved_companies.developer, involved_companies.company.name;
     where id = (${ids.map(Number).join(",")});
     limit 500;`;
  const games = await runQuery<IgdbGame[]>(body, creds);
  return new Map(games.map((g) => [String(g.id), developersOf(g)]));
}

/** Throws an ApiError if the credentials don't work. */
export async function validateIgdb(creds: IgdbCredentials) {
  await igdbQuery("games", "fields name; limit 1;", creds);
}
