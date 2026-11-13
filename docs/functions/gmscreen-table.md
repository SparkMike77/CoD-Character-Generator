# GMScreen + VTT table

One plain-language diagram per function added for running the VTT table inside GMScreen (2026-11-13).

[Back to index](README.md)

## GmServer.tablePlayer

`gmscreen/src/gm-server.js` - The VTT table asks who's behind a pairing token: their sheet's name and avatar (look only), or nothing if it isn't a pairing.

```mermaid
flowchart LR
  I0["pairing token"] --> F
  F(("GmServer.tablePlayer"))
  F --> O0["the player's sheet name + avatar"]
  F --> O1["or "no sheet yet""]
  F --> O2["or nothing (not paired)"]
```

## GmServer.reportTableLook

`gmscreen/src/gm-server.js` - A player who paired from the table's browser lobby (no Character Manager): puts the name and look they picked there on the Roster. Never overwrites a Character Manager's avatar.

```mermaid
flowchart LR
  I0["pairing token"] --> F
  I1["name"] --> F
  I2["avatar description"] --> F
  F(("GmServer.reportTableLook"))
  F --> O0["Roster updated"]
```

## startTable

`gmscreen/src/main.js` - Starts the VTT table inside GMScreen on its own port: serves /vtt/, the live game channel, and links joining to this session's pairing and players' sheets.

```mermaid
flowchart LR
  I0["GmServer"] --> F
  I1["the table's built files"] --> F
  I2["this app's avatar models"] --> F
  F(("startTable"))
  F --> O0["table running at /vtt/"]
  F --> O1["follows Roster changes"]
```

## loadTable

`gmscreen/src/js/renderer.js` - The first time the Table tab is opened, loads the table's Storyteller view (with this run's secret) into it.

```mermaid
flowchart LR
  I0["Table tab opened"] --> F
  F(("loadTable"))
  F --> O0["Storyteller view shown in the tab"]
```

## GmScreenClient.tableUrl

`src/js/gmscreen-client.js` - The address of a paired GMScreen's table, with this device's pairing in the link (#fragment, never sent in a request).

```mermaid
flowchart LR
  I0["GMScreen id"] --> F
  F(("GmScreenClient.tableUrl"))
  F --> O0["table address with the pairing"]
  F --> O1["or nothing if not paired"]
```

## gmscreen:openTable

`src/main.js` - Character Manager's Join table: opens the GM's table in its own sandboxed window.

```mermaid
flowchart LR
  I0["GMScreen id"] --> F
  F(("gmscreen:openTable"))
  F --> O0["a Table window"]
  F --> O1["whether it opened"]
```
