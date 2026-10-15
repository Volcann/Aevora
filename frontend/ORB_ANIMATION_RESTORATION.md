# Orb animation restoration — corrected delivery

These archives supersede `frontend-playful.zip` and `electron-playful.zip`.

## Restored, without redesign

The entire `apps/web/components/orb/` directory is restored byte-for-byte from each corresponding original upload. This includes `OrbEyes.tsx` and `OrbEyes.module.css`: the original eye markup, animations, gaze, blinking, reactions and interaction timing are back. The added `useOrbEyes.ts` and `eye-behavior.ts` implementation is not included.

The orb body, internal shader/flow, canvas renderer, colors, geometry, movement, sparks and floating-window animations are the original source. API clients, IPC, object/tool streaming and dependencies are unchanged. The standalone and desktop frontends are not substituted for one another.

To honor the animation boundary, the eye-layer behavior/performance/lifecycle changes from the previous delivery were also removed. The previous new eye-behavior tests and expression previews are deliberately not carried forward: they describe the withdrawn implementation.

## Retained changes outside the orb

Only two production files per frontend differ from the original upload:

- `apps/web/hooks/useDialogFocus.ts`: keep the latest close callback without restarting the focus-trap effect on callback identity changes.
- `apps/web/components/chat/Chat.module.css`: retain the prior appended welcome-copy, suggestion-card and send-button effects, reduced-motion gating and keyboard focus styling. The complete original stylesheet remains an unchanged prefix. Neither the orb nor its containing welcome element is animated by these additions.

Two stale hash entries in `docs/optimization/protected-source.json` are corrected using the original uploaded bytes of `Orb.module.css` and `OrbVisual.tsx`. Those production files are not modified. There are no package, dependency, API, IPC or build-configuration changes. Generated TypeScript/Turbo caches and the desktop archive's local `.git` pointer are omitted.

## Verification run on the corrected sources

- Complete original orb-directory byte comparisons: **17/17 standalone files**, **12/12 desktop files**, with no added orb files.
- Full original-file comparisons, excluding the two retained production edits, corrected verification metadata and omitted local/generated files: **164 unchanged files** in the frontend archive; **175 unchanged files** in the Electron archive.
- Original UI source-preservation and append-only CSS guards: passed in both frontends.
- Existing standalone orb/model/voice-session tests: **40 passed**.
- Existing frontend streaming tests: **12 passed per frontend**.
- Existing standalone voice orchestration tests: **6 passed**.
- Existing Electron native contract tests: **16 passed**.
- Existing desktop text-session tests: **6 passed**.
- Existing Electron original-interior/theme and IPC integrity check: passed.

That is **92 passing unit tests** in this correction run, plus source-integrity checks. Logs and machine-readable results are in `docs/orb-restoration/`; desktop-frontend-specific logs are in `electron/frontend/docs/orb-restoration/`.

The newly included archive-specific integrity guard runs from either archive's project root with:

```sh
node scripts/verify-restoration.mjs
```

It requires Node but no package installation, fingerprints the actual original archives, checks all unchanged original files and the recorded retained changes, verifies the original chat CSS prefix, and rejects added or missing orb files.

These are source-integrity and existing unit-test results. Browser visual tests, a production Next build, a real Electron launch and live-backend integration were **not rerun for this correction**. The previous eye/browser test results and preview do not validate or represent this restored version. Existing historical `docs/optimization/` and `docs/verification/` material from the original uploads remains historical.

## Apply

Use the corrected archive for its corresponding project, rather than overlaying it onto the previous playful folder. Preserve your own `.env` files and local service configuration. A fresh project-folder replacement removes the withdrawn eye helpers and their tests. Reinstall dependencies and rebuild using your existing workflow; old built output is not a representation of these corrected source files. No API migration or configuration change is needed.
