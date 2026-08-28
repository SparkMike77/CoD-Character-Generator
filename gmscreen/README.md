# GMScreen

The GM-facing server half of the CoD Character Manager project. An Electron app in its own right, meant to run alongside — not inside — the player-facing client.

## Status

Early. Networking/pairing is real and working; the actual GM planning/session-running UI hasn't been built yet.

## Intended role

- Serves options and configuration data to the **CoD Character Manager** client (character templates, house rules, splat availability, whatever else a GM wants to standardize across their table).
- Gives the GM their own interface for planning and running game sessions.
- The client is the player-facing tool; GMScreen is the GM-facing counterpart it talks to.

## How pairing works

GMScreen advertises itself on the local network via mDNS (`_gmscreen._tcp`) so Character Manager can find it automatically — GMScreen advertises, the client only ever browses, it doesn't advertise itself.

Because a WiFi network (home or a shared one at a convention/game store) can have strangers on it, or multiple unrelated GMScreen instances at once, discovery alone isn't enough to connect. Each GMScreen instance generates a 6-digit PIN on launch (shown in its window, with a manual "Rotate PIN" if it needs to be invalidated) that the GM reads out to their players. A client has to submit that PIN to the *specific* instance it wants to join before it's issued a token; the token is what actually authenticates the connection from then on, so the PIN itself only has to be entered once per device.

PINs are checked against the specific instance the player selected, not broadcast — and repeated wrong guesses from the same source get a temporary lockout (5 attempts, then a 60s cooldown) since 6 digits is guessable on a busy shared network.

Session state (paired devices, current PIN) lives in memory only for now — restarting GMScreen clears all of it, and previously paired players will need the new PIN.

## Running it

```
npm install
npm start
```

Opens a window showing the session name (editable), the current PIN, and how many players are currently paired.

## Building a Windows executable

```
npm run dist
```

Output goes to `release/`.
