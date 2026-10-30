# Media Tracker

A personal desktop app (Windows & Linux) to track favorite movies and video games:
search them, add them to a library, rate them and keep notes. Works offline for
anything already saved.

Built with Tauri v2, React, TypeScript, Tailwind CSS and shadcn/ui.
Movie data from [TMDB](https://www.themoviedb.org), game data from [IGDB](https://www.igdb.com).

## Development

```bash
npm install
npm run tauri dev
```

Searches go through a small Cloudflare Worker that holds the API keys (see
[`worker/README.md`](worker/README.md)). Put its address and password in
`.env.local` (copy `.env.example`) before building. Users can also enter their
own keys in Settings. Never commit keys.
