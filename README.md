# CoD Character Generator

A compiled Windows character generator and play tool for **Chronicles of Darkness, 2nd Edition** (the Storytelling System by Onyx Path Publishing).

This is a fan-made, unofficial utility. It is not affiliated with, endorsed by, or sponsored by Onyx Path Publishing or Paradox Interactive. No Onyx Path artwork, logos, or copyrighted text are included or redistributed — the character sheet layout was used only as a structural reference and was reimplemented with original, generic styling.

## Status

Early development. Version 1 targets **baseline human characters** only. Support for other Chronicles of Darkness templates/species may follow later.

Game mechanics (dice pools, chances, splat-specific rules, etc.) are being layered in incrementally as they're defined.

## Tech stack

Electron (HTML/CSS/JS), packaged to a Windows executable via `electron-builder`.

## Development

```
npm install
npm start
```

## Building a Windows executable

```
npm run dist
```

Output goes to `release/`.
