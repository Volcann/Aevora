# Orb and companion regression tests

## Core

After `npm ci` in frontend:

```sh
npm run test:orb
```

This compiles the core into a temporary directory, executes Node's test runner,
and removes the directory afterwards. It covers speech queues, stale callbacks,
resource release, permission races, call/mute state, Strict Mode lifecycle,
transcript retention, themes and speech timing. TypeScript is resolved from the
installed workspace. `ORB_TYPESCRIPT_PATH` is an optional offline test override.

## Browser

```sh
npm run test:orb:fixture
python -m pip install playwright
python -m playwright install chromium
npm run test:orb:browser
```

On headless Linux where software WebGL needs a display:

```sh
xvfb-run -a python tests/orb/browser_smoke.py
```

Set `CHROMIUM_PATH` to use a locally installed Chromium. Fixture assets default to
`.orb-test-build/`; results default to `test-results/orb/`. Override them with
`ORB_BROWSER_OUTPUT` and `ORB_RESULTS_DIR` respectively.

The builder normally uses the installed project React version. The included
verification run instead used locally available React 18.2.0 production modules
via `ORB_REACT_VENDOR_DIR`; those compatibility modules are not shipped and do
not change the project dependencies. Do not treat that run as React 19/Next 16
production verification. Rerun with installed project dependencies before release.

The fixture executes actual orb, chat, call and companion components in React
StrictMode, with real DOM/WebGL. It replaces API, speech-service and native IPC
boundaries and icons with test doubles. A synthetic WebAudio tone drives a real
analyser for microphone-energy verification. Auth/settings views are excluded.
The test-local in-memory storage is necessary for about:blank pages in sandboxed
Chromium; it does not replace production localStorage.

The checks cover desktop/mobile overflow, modal focus, all five original themes,
GPU resource reuse, no frame-rate React rerenders, permission races, no accidental
recording, real-energy vibration, call mute/hang-up/interruption, late callbacks,
IME composition, reduced motion, hidden tabs, context loss, resource disposal,
fallback visibility, native command contracts and unsupported native speech.

These tests do not substitute for an actual Tauri integration test. Run the
checklist in `src-tauri/README_COMPANION.md` on the intended target OS.
