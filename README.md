# Media Tracker

A personal desktop app (Windows & Linux) to track favorite movies and video games:
search them, add them to a library, rate them and keep notes. Works offline for
anything already saved.

Built with Tauri v2, React, TypeScript, Tailwind CSS and shadcn/ui.
Movie data from [TMDB](https://www.themoviedb.org), game data from [RAWG](https://rawg.io).

## Development

```bash
npm install
npm run tauri dev
```

API keys are entered in the app's Settings screen and stored locally — never commit them.
