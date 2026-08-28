# GMScreen

The GM-facing server half of the CoD Character Manager project.

## Status

Scaffolding only — not implemented yet. This directory exists so the two apps can develop side by side in the same repo. Build details (transport, data format, auth, hosting) are still to be decided.

## Intended role

- Serves options and configuration data to the **CoD Character Manager** client (character templates, house rules, splat availability, whatever else a GM wants to standardize across their table).
- Gives the GM their own interface for planning and running game sessions.
- The client is the player-facing tool; GMScreen is the GM-facing counterpart it talks to.

## Running the scaffold

```
cd gmscreen
npm start
```

Starts a bare Node HTTP server on `http://localhost:4177` that responds with a status JSON payload — just enough to confirm the process runs. No real endpoints yet.
