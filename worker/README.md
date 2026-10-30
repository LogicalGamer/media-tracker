# Media Tracker API proxy (Cloudflare Worker)

A tiny server that holds the TMDB and IGDB keys so friends can use the app
without creating their own. Runs free on Cloudflare Workers.

```
app  ──X-App-Key──▶  this Worker (keys stored as secrets)  ──▶  TMDB / IGDB
```

## One-time setup

```bash
cd worker
npm install
npx wrangler login          # opens the browser to log in to Cloudflare
npm run deploy              # prints the Worker URL: https://media-tracker-api.<you>.workers.dev
```

Then add the four secrets, either in the Cloudflare dashboard
(Workers & Pages → media-tracker-api → Settings → Variables and Secrets → Add, type "Secret")
or from the terminal with `npx wrangler secret put <NAME>`:

| Name                 | Value                                   |
| -------------------- | --------------------------------------- |
| `TMDB_TOKEN`         | TMDB API Read Access Token              |
| `IGDB_CLIENT_ID`     | Twitch app Client ID                    |
| `IGDB_CLIENT_SECRET` | Twitch app Client Secret                |
| `APP_KEY`            | any random password (also used by the app) |

Finally, in the app folder copy `.env.example` to `.env.local` and fill in the
Worker URL and `APP_KEY`. Builds made after that search through the Worker.

## Updating

Edit `src/index.ts`, then `npm run deploy`. Logs: `npx wrangler tail`.
