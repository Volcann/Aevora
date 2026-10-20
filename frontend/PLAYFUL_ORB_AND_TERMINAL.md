# Playful orb and chat terminal update

This revision is frontend presentation and interaction only. It builds on the
uploaded `Aevora-frontend-source-2026-10-20.zip`. The original orb artwork is retained.

## Open the controls

Open **Settings → Companion & Voice → Orb playground**, or click the floating orb and
expand **Orb playground** inside its companion panel. In the detached companion,
expand the chat and use the new playground button in the header.

The initial state uses **Classic** personality and **Original** color treatment.
The selected original shader palette, glow, eyes, and idle appearance remain as
before. **Fluid** response morphing is enabled only while a response is pending
or streaming. It stops and removes its displacement filter at completion.

Use **While responding → Original** to retain the old response animation too.
**Original look & motion** resets the added motion and color treatment without
changing the original palette you selected. **Bring orb home** or the Home key
returns the main-workspace pet to its resting position and selects Classic.

## Play modes and interaction

There are seven personalities: Classic, Float, Bounce, Orbit, Follow, Roam,
and Sleepy. Float, Bounce and Orbit animate around the resting position; Follow
and Roam travel within the main workspace. Sleepy adds slower breathing and
uses the existing sleepy-eye expression; streaming wakes it up.

Drag the orb to move it, or release a moving drag to toss it with decaying
inertia and edge rebounds. A drag does not accidentally open the chat. Holding
still before release cancels stale fling velocity; pointer cancellation stops
safely. Focus its button and use arrow keys for 16-pixel movement, Shift+arrows
for 64 pixels, Home to return, or Escape to stop travel.

Roam and Follow pause while the companion panel is open, while hovering over
the orb, while holding the pointer elsewhere, and briefly during typing.
Follow leaves space around the pointer instead of covering the clicked target.
Positions are bounded and saved. The compact-screen default resting position
leaves the main Send button accessible; the companion panel stays inside the
viewport and scrolls when space is limited.

In the detached native window, Roam reuses the already-existing bounded nudge
API, with no native implementation changes. It runs only when the panel is
collapsed and not hovered, with at most five movement calls per second and one
outstanding request. Follow is disabled there: tracking the pointer across the
whole operating-system desktop would require a different native capability.
Drag and keyboard movement still use the existing native controls.

Gentle, Balanced and Lively energy settings adjust the added motion. Wiggle,
Hop, Spin and Celebrate buttons trigger local reactions without sending a
prompt. Preferences persist locally and synchronize through the existing
same-origin browser storage mechanism. Blocked or corrupt storage falls back
safely to in-memory settings.

## Themes and streaming shapes

All six existing shader palettes are unchanged. Four optional outer color
treatments—Moonstone, Sunset, Aurora and Candy—add variety without replacing
shaders or palette data. Original applies no extra color filter.

Fluid, Pulse, Elastic and Ribbon provide organic response motion. Fluid adds
an animated SVG displacement to the original rendered artwork; the others use
rounded pulses or squash/stretch transforms. Small impulses are triggered by
actual response-text growth rather than simulated audio or made-up activity.
The response avatar, floating companion and detached companion use the same
motion layer. The settings preview is entirely local.

Added motion stops when hidden, off screen, inactive according to the existing
native render-state signal, or reduced motion applies. The standalone version
also honors its existing explicit motion override. Original renderer lifecycle
and fallback behavior remain untouched.

## Read-only terminal

Both saved and live tool-output panels now have terminal window chrome, a
monospace output area, line numbers, basic ANSI colors, status indicators, a
live caret, and a separate toolbar. The panel displays only the logs and tool
status supplied by the existing frontend events. It does not invent commands,
exit codes, timings, or output, and it cannot execute shell commands.

Search filters the displayed lines and highlights matches. Line wrapping is
optional. Copy and download export the full plain-text log, including content
outside the displayed limit. The terminal keeps its own follow-output state:
scroll up to inspect earlier output, then use Jump to latest to resume.
Terminal scrolling does not depend on the surrounding chat's follow state.

Live logs remain accessible after response text begins, and the existing
history/log component interfaces are preserved. At most 1,200 recent lines and
240,000 recent characters are rendered, with a disclosure when truncated.
Terminal content is rendered as React text, never injected HTML; OSC links and
unsupported control sequences are stripped. Copy failures are reported.

## Preservation and scope

`npm run verify:playful` verifies hashes against the actual uploaded archive,
not a regenerated version of an older manifest. It checks 194 original files byte
for byte, the full original chat stylesheet prefix, and unchanged package
configuration, dependencies, lockfiles and existing scripts. It permits only
the explicitly listed UI integration edits and new test-script entries.

The orb renderer, shader source, palette definitions, eyes, original orb CSS,
API modules, auth, streaming/session implementations, and native Electron code
are byte-identical to the upload. Only six existing UI files were changed per
frontend, including an append-only chat CSS rule; new components live under
`components/orb/playful/` and `components/chat/terminal/`. No production
dependencies were added. The standalone frontend keeps its existing voice features and session behavior. The protected voice components were not rewritten.

## Run and verify

```sh
npm ci
npm run dev
```

The existing `npm run check-types`, `npm run lint` and `npm run build`
commands remain unchanged. Use the normal configured backend for real login,
responses and tool output.


With normal project dependencies installed, run from the frontend workspace:

```sh
npm run verify:playful
npm run test:playful
npm run build:styles --workspace=@repo/ui
npm run test:playful:fixture
npm run test:playful:browser
```

The browser test additionally needs Python's Playwright package and Chromium.
Set `CHROMIUM_PATH` to a local Chromium executable when needed. Tests use an
inline page so they also work in managed browsers that forbid localhost
navigation. Do not ship the generated `.playful-test-build` fixture as the app.
The browser harness deliberately doubles API, native, clipboard and storage
boundaries; it never contacts a backend.

### Results from this preparation environment

- 18/18 new model tests: preferences, bounds, fling integration, safe text,
  ANSI handling and output limits. Strict TypeScript checks pass for both
  new pure model modules.
- 11/11 browser scenario groups in this source variant, including interaction,
  settings, native-window UI, live output, storage fallback, reduced motion,
  and layouts at 1360×900, 390×844, 320×640 and 667×375.
- 40/40 existing orb renderer/model/voice-session regression tests.
- Upload-based preservation checks pass. 

Evidence is in `docs/playful-verification/`: JSON browser results, TAP output,
preservation manifest/report and screenshots. The screenshots show synthetic
fixture logs and generic test icons; they are test evidence, not live backend
results or exact production screenshots.

**Verification limit:** dependency installation failed with registry DNS
`EAI_AGAIN`. A full production Next.js/React 19 build, full workspace typecheck,
lint, real backend session and installed Electron executable could not be
validated here. Browser checks used the real application TSX/CSS with locally
available React 18.2 compatibility runtime, TypeScript 5.8.3, Tailwind 4.1.10
and dimension-preserving icon doubles. They are useful UI checks, not a
substitute for testing the declared production dependencies and target OS.
The extracted test runtime, generated fixture and temporary CSS build are not
included in the delivered source ZIP.

### Older integrity checks already disagree with the upload

The original `verify:ui` manifest already contains stale hashes for these
files *inside the uploaded ZIP*:

- `apps/web/components/orb/OrbVisual.tsx`
- `apps/web/components/orb/OrbVoiceExperience.tsx`
- `apps/web/components/orb/core/orb-renderer.ts`
- `apps/web/lib/desktop-runtime.ts`
- `apps/web/lib/text-session.ts`

Those files remain byte-identical to the upload in this revision. The older
manifests and existing scripts were deliberately left unchanged, so an older
`verify:ui` or `test:optimization` invocation can still fail on those pre-existing
mismatches. The new independent baseline records the source ZIP's SHA-256 and
verifies preservation without concealing the discrepancy.
