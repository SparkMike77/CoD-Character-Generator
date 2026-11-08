# CoD Characters for Android (and Chromebooks)

The player app (Character Manager) as an Android app. One APK runs on Android phones, tablets, and
Chromebooks (which run Android apps). It's the same sheet as the Windows app - the page files in
`src/` are copied in at build time - so sheet changes need no Android work, just a rebuild.

## How it fits together

- **`app/`** - a small Kotlin app, framework only (no libraries):
  - `MainActivity.kt` shows the sheet in a WebView, served from inside the app at
    `https://appassets.androidplatform.net/` (ES modules and the 3D avatar need a real, secure
    origin). It also does what a page can't: the HTTP calls to GMScreen (a page on an https origin
    can't call plain-http GMScreen), Android's file picker for Open / Save, and the Back key.
  - `GmDiscovery.kt` finds GMScreens on the network with Android's NSD (mDNS), like the Windows
    app's Bonjour browser.
- **`web/`** - `android-main.js` builds the same `window.codApi` the Electron preload provides, so the
  sheet's code runs unchanged. The GM connection and chronicle logic is the Windows app's own
  `src/js/gmscreen-client.js` and `campaign-store.js`, untouched: the build bundles them with their
  Node modules (`http`, `fs/promises`, `events`, `bonjour-service`, `crypto`) swapped for the
  stand-ins in `web/shims/`, which hand the work to the app.
- Chronicles and GM pairings live in the app's own storage (they'd be JSON files in the Windows
  app's data folder). Characters are ordinary `.codchar` files wherever the player saves them.

## Building

Needs a JDK and the Android SDK (`local.properties` holding `sdk.dir=...`, not committed).

    npm run android                  # debug APK -> release/android/CoD-Characters-<version>-debug.apk
    npm run android -- --install     # ...and install it on the device connected over adb

Before handing out a new build, bump `versionCode` in `version.properties` - Android only installs
an update with a higher one.

The debug APK is signed with this computer's debug key: fine for sideloading onto test devices, but
an update must come from the same computer (or the app must be uninstalled first). For a release
build (`npm run android -- --release`), put a keystore in `~/.cod-android/` with a
`keystore.properties` (`storeFile`, `password`, `keyAlias`) - see `app/build.gradle.kts`.

## Installing

**Android phone / tablet:** copy the APK over (USB, Drive, email...) and open it; Android asks to
allow installing from that source. Or, with USB debugging on, `npm run android -- --install`.

**Chromebook:** ChromeOS doesn't open APK files directly. Once per Chromebook:
Settings > About ChromeOS > Developers > Linux development environment > Develop Android apps >
turn on **Enable ADB debugging** (this restarts the Chromebook; turning it off again later
requires a powerwash/reset). Then, in the Linux Terminal, `sudo apt install adb`,
`adb connect arc`, and `adb install CoD-Characters-<version>-debug.apk`.

## Connecting to the GM

The GM Sessions button lists GMScreens found on the network. Where discovery doesn't work (some
Wi-Fi networks block it), "Not listed?" takes the address GMScreen shows on its Session tab
(`Advertising as ...`). Either way the app reconnects by itself next time.

## Debugging

Debug builds can be inspected from Chrome on the computer the device is plugged into
(`chrome://inspect`), and copy the page's console to logcat under the tag `CodPage`.

## Known limits

- Phones get a one-column layout (the `max-width: 700px` rules at the end of `src/css/style.css`);
  tablets and Chromebooks get the normal desktop layout at their own width.
- An unsaved character is lost if Android closes the app in the background - save as you go.
- No Print / Export PDF.
