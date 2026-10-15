"""Observe streaming render counts in the current or an untouched baseline fixture.

AEVORA_TEST_BUILD_DIR selects the fixture. Pass an output JSON path as argv[1].
This is a render-count experiment, not a CPU, FPS, memory or bundle benchmark.
"""
import json
import os
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright
import browser_smoke as ui

with sync_playwright() as playwright:
    kwargs = {'headless': True}
    if os.getenv('CHROMIUM_PATH'):
        kwargs['executable_path'] = os.environ['CHROMIUM_PATH']
    browser = playwright.chromium.launch(**kwargs)
    page = ui.boot(browser, options={'sessions': ui.SESSIONS, 'messages': ui.MESSAGES})
    ui.send(page)
    page.wait_for_timeout(100)
    before = page.evaluate('({...fixture.renders})')
    for index in range(20):
        page.evaluate("fixture.stream.onChunk('x')")
        page.wait_for_timeout(35)
    after = page.evaluate('({...fixture.renders})')
    page.evaluate("fixture.finish(' A complete response. '.repeat(20))")
    page.wait_for_timeout(2200)
    report = {
        'scope': 'Observed renders after the streaming state is already active; six completed assistant messages, twenty one-character chunks, 35ms apart.',
        'runtime': json.loads((ui.BUILD / 'build-metadata.json').read_text()),
        'renderDelta': {key: after[key] - before[key] for key in before},
        'responseStillStreamingAfter2200ms': page.get_by_role('button', name='Stop response', exact=True).count() > 0,
        'pageErrors': ui.ERRORS[page],
    }
    ui.done(page)
    browser.close()
output = Path(sys.argv[1]) if len(sys.argv) > 1 else ui.OUTPUT / 'render-measurement.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
