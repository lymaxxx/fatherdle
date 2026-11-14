# Fatherdle

Daily games. One table. A league tracker for Wordle, MapTap, Krillion, Noillirk, Huedle,
Flagdle, Catfishing, Poople and Wordishingrilliontapdle: paste share text, see standings.

## Run locally

```bash
npm install
npm run dev          # empty league, real Europe/London date, data in data/league.json
npm run dev:demo     # fictional six-player league, "today" pinned to 14 Nov 2026
npm test
```

Useful switches (environment variables): `FATHERDLE_TODAY=2026-11-16` pretends it is that day (try the
Monday banner), `FATHERDLE_SEED=none` skips the preloaded chat history.

## Deploy to Netlify

1. Push this repo to GitHub, then in Netlify choose **Add new site -> Import an existing project**
   and pick the repo. `netlify.toml` already sets the build command and Node version.
2. Deploy. League data (players and submissions) is kept in **Netlify Blobs**, which needs no setup
   and survives redeploys.
3. Optional: set `FATHERDLE_DEMO=1` to try the demo league. Demo and live data are stored under
   separate keys, so switching never mixes them.

Or from the command line:

```bash
npm i -g netlify-cli
netlify login
netlify deploy --build --prod
```

Note: Netlify needs its Next.js runtime, so a plain drag-and-drop of a build folder will not work;
use Git or the CLI.

## How it works

- `src/lib/db` stores one JSON document (players + submissions) in Netlify Blobs, or in
  `data/league.json` locally.
- `src/lib/analytics` holds the points, standings, insights and per-game modules.
- A game counts towards the league once 4 players have submitted (Qualified); until then it is
  Pending. Points are inverse rank, ties share a place.
- The league resets to nothing if the blob store is cleared; there is no login, so anyone with the
  link can join and submit.

## Troubleshooting

If the site shows "Couldn't load the league" the message underneath is the server error. If it says
Netlify Blobs is not configured, add two environment variables in Netlify and redeploy:

- `FATHERDLE_BLOBS_SITE_ID`: your site's ID (Site configuration -> General -> Site ID)
- `FATHERDLE_BLOBS_TOKEN`: a Netlify personal access token (User settings -> Applications)
