# Enhanced eyes and cleaner companion UI

## Scope of this delivery

This revision supersedes the earlier `*-playful.zip` and `*-orb-preserved.zip` deliveries. The eyes are intentionally enhanced; the orb's original WebGL interior, body styling, colors, model, shaders, renderer, and drag/fling physics are preserved. Deliberate bounce/flip tricks and the footer are removed as requested. This is not a claim that the entire orb directory is unchanged.

Use `frontend-eyes-clean-ui.zip` for the standalone frontend. Use `electron-eyes-clean-ui.zip` for the Electron project, which includes its own distinct, text-only frontend. Do not replace Electron's frontend with the standalone voice-enabled project.

## Visible changes

**Eyes.** The original socket placement and capsule silhouette now contain more detailed pupils, shaded irises, corneal highlights, and eyelid apertures. Listening looks attentive; thinking looks focused; completing a response gives a short content expression. Gentle happy and sleepy expressions remain. Pointer tracking and blinking affect the eye layer only. Reduced-motion and renderer/background suspension are respected.

**No tricks.** The manual reaction controls are removed from the desktop footer and the in-app companion. There is no bounce/flip shortcut, double-click flip, or eye-controller click-hop. Legacy `orb:trick` events are inert in the eye controller. Existing explicitly supplied eye-mood values remain accepted for compatibility, but heart/dizzy trick reactions are not triggered automatically. Original drag/fling boundary physics and movement styling remain unchanged; they are distinct from the removed manual bounce trick.

**No footer.** The complete composer footnote/footer is removed, including its instruction text, reaction buttons, and “Open in main app” button. The separate header “Open main chat” action remains; it is not part of the deleted footer. The composer, model/tool controls, stop/send actions, and existing window controls remain.

**Readable bold text.** The floating chat and in-app companion use the shared Markdown renderer rather than showing raw asterisk markers. `**bold**` and `__bold__` produce semantic, visibly bold text. Compact paragraph, heading, code, and table spacing is scoped to the companion. The main chat uses the same improved inline parser. Nested emphasis, inline code, escapes, and partial streamed bold delimiters are covered by tests. Literal user messages and stored/transported text are not rewritten. Raw HTML is escaped and unsafe link protocols are rejected.

The parser intentionally remains the app's lightweight Markdown subset, not a full CommonMark implementation. Existing block parsing is retained. No Markdown dependency was added.

## Correctness and performance work

Expression ownership and reset timers are independent of pointer events, so a movement burst cannot cancel an expression's recovery. Releases outside the orb, cancelled presses, unmounts, and hidden/background states clean up their work. Pointer input is coalesced to animation frames without React gaze rerenders. In the two-orb test, 250 synchronous pointer events caused no more than two layout reads and no eye component rerenders.

Opening the floating chat's model/tool menu no longer tears down its session effect. The latest menu state is read through a ref, while the session lifecycle depends on the session itself. This fixes menu interactions that could previously stop an active stream. The send function and its API/stream callbacks remain byte-identical to the original upload.

The prior non-orb dialog-focus fix and append-only main-app welcome/suggestion/send-button styling are retained. They are not new orb animations.

## Preserved source and streaming

No API endpoints, request payloads, response contracts, native IPC implementation, package manifests, or lockfiles were changed. The original API library, text-session implementation, object/tool streaming implementation, voice code where applicable, orb model/shaders/renderer, OrbVisual, Orb.module.css, and CompanionSparks remain unchanged.

The original `SparkingCursor` markup and its global CSS remain unchanged. The shared renderer has an optional, presentation-only cursor switch so companion surfaces retain their own existing streaming cursor without adding a second spark cursor. The original floating-window CSS declarations, transitions, and keyframes are preserved. DesktopPet.module.css changes only extend two message selectors to include the Markdown div and add a small whitespace/min-width rule.

`source-integrity.json` records the supplied archive hash, original file hashes, exactly nine reviewed modifications per project, and five new production files per frontend. The standalone project has 158 original files that remain byte-identical; Electron has 169. These counts include original source, configuration, tests, and documentation—not only production modules.

The verifier additionally checks original fling, drag, floating-chat send, and spark-cursor code fragments. It reverses exactly the authorized Markdown selector additions and compares the entire resulting floating-window stylesheet with the original hash. The old full-file guard excludes only the three deliberately modified companion files; their preserved fragments and CSS are checked by this new guard instead. Earlier restoration-only reports/checks were removed because they would incorrectly describe the enhanced eye layer as original.

Run from either extracted project root:

```sh
node scripts/verify-eyes-companion.mjs
```

Existing UI guards also pass:

```sh
# Standalone frontend root
node scripts/verify-ui-integrity.mjs

# Electron root
node frontend/scripts/verify-ui-integrity.mjs
```

## Verification performed on this delivery

| Verification | Standalone frontend | Electron / bundled frontend |
| --- | ---: | ---: |
| Eye policy unit tests | 23 passed | 23 passed |
| Inline Markdown unit tests | 18 passed | 18 passed |
| Existing streaming tests | 12 passed | 12 passed |
| Existing orb tests | 40 passed | — |
| Existing voice tests | 6 passed | — |
| Existing native contract tests | — | 16 passed |
| Existing text-session tests | — | 6 passed |
| Eye browser checks | 40 passed | 40 passed |
| Companion/Markdown browser checks | 40 passed | 40 passed |

**Totals: 174 unit tests and 160 browser checks passed, with no recorded browser exceptions.** Both projects pass their source-integrity checks. Electron's existing native/orb guard passes. The two pure TypeScript helpers pass a strict typecheck. The real-source browser fixture builders transpile without syntax errors.

Browser checks cover actual visible expression opacity, timer cleanup, reduced motion, pointer performance, removed footer/trick controls, partial and completed bold streams, safe links, literal code/user text, stopping a response, new-chat reset, preserving the stream while menus open, and composer layout at 320×440, 360×552, and 390×650. They also verify the original WebGL renderer compiles and continues drawing frames and that the existing spark canvas/cursor markup remains present.

### Environment and limits

The npm registry was unavailable in this environment (`EAI_AGAIN`). Browser tests therefore used a disclosed offline **React 18.2.0 compatibility runtime**, TypeScript 5.8.3, and Chromium 144.0.7559.96. Production dependency manifests/lockfiles were not changed. Native/API/storage behavior is represented by test doubles in these isolated fixtures; Next's chunk loader is also substituted. Fixture toolbar icons are minimal test SVGs, not a replacement for the application's Lucide icons.

The companion checks exercised the original WebGL code in headed Chromium under Xvfb using software rendering. This validates renderer execution here, not GPU performance on every device. A full pinned React 19/Next production build, whole-workspace typecheck/lint, actual Electron application launch, live-backend integration, and platform installer packaging have **not** been verified for this delivery.

Only logs in `docs/eyes-companion-review/` (and `electron/frontend/docs/eyes-companion-review/` for frontend test logs) describe this revision. Other verification reports inherited from the original uploads are historical, not additional current test results.

## Reproduce and apply

Back up your current projects and keep local environment/configuration files. Replace each corresponding source directory with the new archive instead of overlaying an older delivery. Do not carry over `.next`, `out`, or other compiled output. Reinstall/build using the project's existing scripts so old footer/trick code does not remain in the renderer bundle.

With the project's dependencies installed, from the standalone frontend or Electron's `frontend` directory:

```sh
node scripts/test-eyes.mjs
node scripts/test-companion.mjs
node scripts/test-optimization.mjs
node scripts/build-eyes-fixture.mjs
python tests/eyes/browser_smoke.py
node scripts/build-companion-fixture.mjs
HEADED=1 xvfb-run -a python tests/companion/browser_smoke.py
```

Browser checks require Python Playwright and Chromium; the shown headed command uses Linux/Xvfb. `CHROMIUM_PATH` can point to another installed Chromium executable. Fixture builders use installed project dependencies by default. The private offline compatibility runtime and generated fixture bundles are intentionally not included in the delivery.

Standalone existing checks/build:

```sh
npm run test:orb
npm run test:voice
npm run check-types
npm run lint
npm run build
```

Electron existing checks/build, from its project root:

```sh
npm test
npm run check
npm run build
```

## Preview images

`bot-refined-eyes.png` is a browser capture of the enhanced eye component over the original WebGL renderer, not AI-generated artwork or a fallback sphere. Eye-only CSS transitions were finished at their endpoints for the still comparison; the body/shader source was not modified. It shows Ready, Listening, Thinking, Content, Happy, and Sleepy.

`companion-no-footer.png` is a real-source browser fixture capture of the revised message layout. It uses mocked sample text and test-only toolbar icons. The original application window, shader, and spark styling are retained.
