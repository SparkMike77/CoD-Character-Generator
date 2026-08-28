# CoD Character Manager

A compiled Windows character manager and play tool for **Chronicles of Darkness, 2nd Edition** (the Storytelling System by Onyx Path Publishing).

This is a fan-made, unofficial utility. It is not affiliated with, endorsed by, or sponsored by Onyx Path Publishing or Paradox Interactive. No Onyx Path artwork, logos, or copyrighted text are included or redistributed — the character sheet layout was used only as a structural reference and was reimplemented with original, generic styling.

## Status

Early development. Version 1 targets **baseline human characters** only. Support for other Chronicles of Darkness templates/species may follow later.

Game mechanics (dice pools, chances, splat-specific rules, etc.) are being layered in incrementally as they're defined.

## Repo layout

This repo hosts two apps that will eventually talk to each other:

- **Client** (this directory, root `package.json`) — CoD Character Manager, the player-facing Electron app.
- **[gmscreen/](gmscreen/)** — GMScreen, the GM-facing server. It will hand the client options and configuration data, and give the GM an interface for planning and running sessions. LAN discovery and PIN-gated pairing with the client are working; the actual session-planning UI isn't built yet — see [gmscreen/README.md](gmscreen/README.md).

## Tech stack

Electron (HTML/CSS/JS), packaged to a Windows executable via `electron-builder`.

## Download

Grab the latest Windows installer from the [Releases page](https://github.com/SparkMike77/CoD-Character-Generator/releases/latest) — no build step required.

## Development

```
npm install
npm start
```

## Building a Windows executable

```
npm run dist
```

Builds just this client. Output goes to `release/`.

To build both apps at once:

```
npm run dist:all
```

Installs GMScreen's dependencies if needed and builds both. The client's installer lands in `release/`, GMScreen's in `release/gmscreen/` (kept in a subfolder so the two builds' `win-unpacked/` output and metadata files don't collide).
