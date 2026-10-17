# Eye regression suite

From this frontend workspace after installing its normal dependencies:

```sh
node scripts/test-eyes.mjs
node scripts/verify-emotion-scope.mjs
node scripts/build-eyes-fixture.mjs
python -m pip install -r tests/optimization/requirements.txt
python -m playwright install chromium
python tests/eyes/browser_smoke.py
```

`CHROMIUM_PATH` may point to a local Chromium binary. `AEVORA_EYE_BUILD` and
`AEVORA_EYE_REPORT` override the fixture and output folders. The builder uses the
installed project React by default. `AEVORA_TYPESCRIPT_PATH` and
`AEVORA_TEST_VENDOR_DIR` are explicit offline test seams; their use is recorded in
fixture metadata. No vendor is shipped or substituted into production dependencies.

The browser fixture renders the real eye component and, for visual inspection,
the unchanged OrbVisual. Eye-only mounts isolate timer/frame/layout assertions
from the renderer's legitimate animation loop. The local test run used a React
18.2.0 compatibility runtime, so it is not a production React 19/Next build or a
React 19 development Strict Mode test. Repeated explicit teardown/remount checks
are included. See EMOTION_REVIEW.md for scope, limitations and preservation details.
