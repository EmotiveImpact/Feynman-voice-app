# Design preview

Draws the real app screens in a browser, so design work can be checked with
pictures before anything goes to a phone. Phone-only parts (the on-device
voice, the page scanner, saved files) are swapped for stand-ins in `stubs/`,
and only when `FENNY_PREVIEW` is set. The phone build is not affected.

    # from the repo root, once
    npm install --no-save react-dom@19.3.1 react-native-web @expo/metro-runtime
    # from apps/mobile
    FENNY_PREVIEW=1 npx expo export --platform web --output-dir /tmp/fenny-web

The drawing library (CanvasKit) must load before the app. Copy
`node_modules/canvaskit-wasm/bin/full/canvaskit.{js,wasm}` beside
`index.html`, and change `index.html` so it runs `CanvasKitInit`, sets
`window.CanvasKit`, and only then loads the app's scripts in order.

The profile lives in the browser's localStorage under `fs:doc/profile.json`;
seed it there to show topics, gaps and a streak. Screens: `/`, `/topic`,
`/session?topic=…`, `/map?topic=…`, `/look`, `/intro`.
