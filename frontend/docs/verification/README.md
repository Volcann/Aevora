# Recorded verification

39 core tests passed; 31 Chromium fixture checks passed. No uncaught exceptions
were reported by the fixture. React version: 18.2.0 compatibility runtime.

`core-results.log`: actual Node test output.
`browser-results.json`: all browser check names and results.
`typecheck-results.txt`: strict core TypeScript scope and command.
`syntax-results.json`: syntax parsing for all 55 TypeScript/TSX source files.
`integrity-results.json`: original shader and protected-source hashes.

PNG images are actual fixture screenshots with mocked APIs, speech and native
IPC. They are not images of a compiled Tauri window or production Next build.
The audio-level check used real WebAudio driven by a synthetic tone, not a person
speaking into a physical microphone.

Additional checks: desktop staging copies the source app and workspace paths,
omits only the server entrypoint from the temporary client copy, and preserves
the original source proxy/API. The helper scripts passed Node syntax checks.

Production dependency installation was attempted with `npm ci --offline
--ignore-scripts` and failed with ENOTCACHED for React. The configured production
Next build and Rust/Tauri compilation were not run. Native Rust geometry tests
are present in source but unexecuted. See the root README for all limitations.
