// Media Tracker API proxy — runs on Cloudflare Workers (free plan).
//
// The desktop app sends its TMDB / IGDB requests here instead of straight to
// those APIs. This Worker adds the real API keys (stored as Cloudflare secrets)
// and forwards the request, so the keys never ship inside the app.
//
//   GET  /tmdb/3/search/movie?query=...   ->  https://api.themoviedb.org/3/search/movie?query=...
//   POST /igdb/games  (Apicalypse body)   ->  https://api.igdb.com/v4/games
//
// Every request must carry the header `X-App-Key: <APP_KEY>`. That key is
// built into the app, so it only keeps out random visitors, not a determined
// person — fine for sharing with friends.

export interface Env {
  TMDB_TOKEN: string; // TMDB "API Read Access Token"
  IGDB_CLIENT_ID: string;
  IGDB_CLIENT_SECRET: string;
  APP_KEY: string; // shared password the app sends
}

// Only these upstream paths can be reached, so the Worker can't be used as a general proxy.
const TMDB_PATHS = [/^\/3\/search\/movie$/, /^\/3\/configuration$/, /^\/3\/genre\/movie\/list$/, /^\/3\/movie\/\d+$/];
const IGDB_ENDPOINTS = new Set(["games"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Browsers ask permission first (CORS "preflight"); only matters for `npm run dev` in a browser.
    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));

    if (request.headers.get("X-App-Key") !== env.APP_KEY) {
      return withCors(json({ error: "unauthorized" }, 401));
    }

    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname.startsWith("/tmdb/")) {
        return withCors(await proxyTmdb(url, env));
      }
      if (request.method === "POST" && url.pathname.startsWith("/igdb/")) {
        return withCors(await proxyIgdb(url, await request.text(), env));
      }
      return withCors(json({ error: "not found" }, 404));
    } catch {
      return withCors(json({ error: "upstream unreachable" }, 502));
    }
  },
};

async function proxyTmdb(url: URL, env: Env): Promise<Response> {
  const path = url.pathname.slice("/tmdb".length); // "/3/search/movie"
  if (!TMDB_PATHS.some((re) => re.test(path))) return json({ error: "not allowed" }, 403);

  const upstream = await fetch(`https://api.themoviedb.org${path}${url.search}`, {
    headers: { Authorization: `Bearer ${env.TMDB_TOKEN}`, accept: "application/json" },
  });
  return passThrough(upstream);
}

async function proxyIgdb(url: URL, body: string, env: Env): Promise<Response> {
  const endpoint = url.pathname.slice("/igdb/".length); // "games"
  if (!IGDB_ENDPOINTS.has(endpoint)) return json({ error: "not allowed" }, 403);

  const send = (token: string) =>
    fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: { "Client-ID": env.IGDB_CLIENT_ID, Authorization: `Bearer ${token}`, accept: "application/json" },
      body,
    });

  let token: string;
  try {
    token = await getIgdbToken(env);
  } catch {
    return json({ error: "IGDB login failed: check the Worker's IGDB secrets" }, 502);
  }
  let upstream = await send(token);
  // token expired or revoked early: get a new one and try once more
  if (upstream.status === 401) upstream = await send(await getIgdbToken(env, true));
  return passThrough(upstream);
}

// The Twitch token lasts ~60 days. Keep it in memory while this Worker instance
// is alive; a fresh instance simply asks for a new one (one cheap request).
let igdbToken: { value: string; expiresAt: number } | null = null;

async function getIgdbToken(env: Env, forceNew = false): Promise<string> {
  if (!forceNew && igdbToken && Date.now() < igdbToken.expiresAt) return igdbToken.value;

  const params = new URLSearchParams({
    client_id: env.IGDB_CLIENT_ID,
    client_secret: env.IGDB_CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: "POST" });
  if (!res.ok) throw new Error(`Twitch token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  igdbToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return igdbToken.value;
}

/** Returns the upstream reply as-is (status + JSON body), so the app's error handling still works. */
async function passThrough(upstream: Response): Promise<Response> {
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function withCors(res: Response): Response {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Headers", "X-App-Key, Content-Type");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return res;
}
