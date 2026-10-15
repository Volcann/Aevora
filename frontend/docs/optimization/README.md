# Optimization and UI verification

This report covers the changes in this delivery. Older `docs/verification` files were supplied with the original repository and are retained as historical material; they are not new production-build results.

## Preserved behavior and appearance

31 protected source files are byte-identical to the supplied archive. They cover the orb components, shaders, styling and theme definitions, the companion implementation, global styles, and relevant voice/text lifecycle files. All six original themes, including the RGB Chroma default, are preserved. The original Chat stylesheet remains an exact byte prefix of the new file: layout rules were appended without deleting existing selectors, keyframes or transitions. No animation or user-facing feature was removed. The standalone app retains voice; the Electron workspace retains its deliberately text-only design.

`protected-source.json` and `append-only-css.json` hold the original SHA-256 evidence. Run `npm run verify:ui` to check it again. The checker is deliberately strict: future intentional modifications to protected sources require conscious review rather than silently regenerating the manifest.

## Code changes

### Rendering and component boundaries

`ChatHistory.tsx` isolates the completed-message list from the live response. Completed rows and Markdown are memoized; the outer history boundary also prevents remapping every completed row for every streamed character. Stable callbacks let the memoized composer, navigation and sidebar avoid unrelated rendering work. Search normalization/filtering and the current-session lookup are memoized. Removed unused `onNewChat`, `onOpenAuth` and top-navigation `onLogout` props; functional logout and new-conversation actions remain.

Settings is loaded through `next/dynamic` on first use. It remains mounted when subsequently closed, preserving unsaved settings. This is a source-level lazy-loading change; no production chunk-size or bundle-size result is claimed.

Redux now creates a store per provider instead of exporting one shared singleton. RTK Query listeners are registered on mount and cleaned up on unmount.

### Streaming correctness without changing animation timing

`streaming-text.ts` owns the main-chat presentation queue and its completion promise. It retains the supplied boosted and normal per-frame character-step formulas. Transport completion waits for the existing typewriter backlog before request cleanup. Idle intervals between chunks no longer poll empty animation frames. Cancellation releases pending work and prevents stale callbacks from resurrecting a turn. This is separate from the protected orb renderer.

### Requests and state consistency

Health no longer delays displaying sign-in. Independent sessions, tools and model requests run concurrently after authentication. Request epochs guard initialization, session loading and selection, deletion and logout against stale responses. Password-reset URLs retain their reset screen. Failed deletions retain the conversation and display a recoverable error; deleting the active final conversation cancels its stream. A late deletion cannot switch away from a newer selection.

### Layout and keyboard access

The model control can shrink without pushing send/voice controls out of the composer. Long labels, account names, model badges and tool status text are constrained or wrapped. The tools/model popover measures available space above the composer and responds to multiline input and viewport resizing. Escape closes it and restores textarea focus.

Auth forms remain scrollable on short displays instead of losing their top edge through centered flex overflow. Settings has bounded viewport height, scrollable content, a wrapping boost badge and responsive connection controls. Close/Done remain reachable. Its focus trap supports Tab, Shift+Tab, Escape and focus restoration without also closing the conversation sidebar. Existing colors, animations and transition classes are retained.

## Verification completed

| Check | Result |
| --- | --- |
| Protected source and original Chat CSS | Pass: 31 source files plus original stylesheet prefix |
| New streaming regression suite | 12/12 pass, including frame-by-frame comparison with both original speed formulas |
| Browser UI scenario groups | 10/10 pass |
| Source syntax/transpilation diagnostics | 70 TypeScript/TSX files; zero syntax errors |
| Strict semantic TypeScript check | Pass for the new streaming module only |

The standalone repo's supplied orb suite had two failures before modification: its expectations used the obsolete fallback theme index 1 and treated index 5 as invalid. The supplied source already contains six themes, defaults to RGB Chroma (index 5), and performs a one-time migration. Only test expectations were corrected; an additional migration regression test was added. The untouched original result is retained in `orb-baseline-tests.tap`. The corrected suite passes 40/40; the separate existing voice suite passes 6/6.

Browser groups cover 1360×900, 390×844, 320×640 and 667×375 layouts; long selected-model names; multiline composer/popover geometry; IME and Shift+Enter behavior; stream completion/cancellation; old-message rendering; session/new-chat request races; failed and late deletion; sign-out; lazy Settings, draft retention and focus; short auth forms and reset links; and the untouched orb renderer. The orb check compiles the real shader, observes additional animation frames without React rerenders, switches all six themes without recreating the GPU program, and checks disposal.

The screenshots and `browser-results.json` describe this isolated test UI, not a launched production app. Browser tests use the actual source components with explicit API, localStorage, media/speech and Electron-bridge doubles. They do not exercise live backend authorization, real microphones or native operating-system windows.

## Before/after render experiment

Same fixture, six completed assistant messages, twenty one-character chunks 35 ms apart. Counting starts after the stream becomes active; counts exclude its initial and final state transitions.

| Observed renders | Supplied source | Optimized source |
| --- | ---: | ---: |
| Completed-message Markdown | 120 | 0 |
| All Markdown, including live reply | 140 | 20 |
| Composer | 20 | 0 |
| Sidebar | 20 | 0 |
| Top navigation | 20 | 0 |
| Closed Settings | 20 | 0 |

The live response still renders on incoming characters. This is a render-count experiment, not a CPU, frame-rate, memory, startup-time or production bundle benchmark. In the same fixture a final transport burst left the supplied version streaming after 2.2 seconds; the optimized version completed. The deterministic streaming tests, rather than this wall-clock observation, establish backlog completion and unchanged step sizes.

Results are in `render-baseline.json` and `render-optimized.json`. `tests/optimization/measure_stream_renders.py` can repeat the observation on either fixture. `AEVORA_TEST_SOURCE_ROOT` and `AEVORA_TEST_BUILD_DIR` allow the fixture builder to target a separately extracted untouched copy without changing production files.

## Environment and unverified checks

Project dependency installation was blocked. The offline install failed with `ENOTCACHED` for React, and registry access was unavailable. Dependency versions and lockfiles were not changed to bypass this.

Local checks used Node 22.16.0 and TypeScript 5.8.3. UI checks used Chromium 144.0.7559.96, Python Playwright 1.57.0, an available React/ReactDOM 18.2.0 compatibility runtime, Tailwind 4.1.10 and icon doubles preserving dimensions. The supplied application targets React 19.2.7 and Next 16.2.10. Compatibility dependencies are **not** included in the delivery or substituted into its package manifests. The fixture uses installed project versions by default; the override is recorded in its metadata.

Layout checks ran headless using the original CSS fallback where WebGL was unavailable. The separate orb shader check ran in headed Chromium under Xvfb with SwiftShader. Utilities/styles are assembled by the isolated fixture rather than Next's production CSS pipeline. Screenshots are useful layout evidence, not a pixel-perfect production or cross-platform visual guarantee.

**Not completed here:** pinned dependency installation, full dependency-aware workspace typecheck, lint, a production Next build/export, a launched native Electron smoke test, installer builds, real backend integration, real media devices or hardware-specific GPU profiling. Syntax-only transpilation is not presented as full application type safety. Provider-scoped Redux behavior was reviewed in source but is outside the UI fixture's Home-page-only runtime. Production bundle savings were not measured.

## Run with the actual project dependencies

Use Node 22 or later and an online dependency registry, then run:

```sh
npm ci
npm run test:optimization
npm run test:orb
npm run test:voice
npm run check-types
npm run lint
npm run build
```

For the new browser suite, from this frontend workspace:

```sh
python -m pip install -r tests/optimization/requirements.txt
python -m playwright install chromium
npm run test:ui
```

`CHROMIUM_PATH` can select an existing Chromium executable. On managed Linux systems that expose WebGL only in a headed display, set `DISPLAY` to a running X display and `HEADED_ORB=1`; only the shader scenario then runs headed. No browser security policy needs to be removed. Temporary fixtures are ignored in Git and excluded from the delivered archive. The production app contains none of the test doubles or compatibility vendors.
