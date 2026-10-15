"""Network-free real-source UI checks; API/native/media boundaries are test doubles.

Run `npm run test:ui` after npm ci and `python -m pip install playwright`.
Set CHROMIUM_PATH to a local Chromium binary, or install Playwright Chromium.
The build metadata records whether the optional compatibility runtime was used.
"""
import base64
import json
import os
from pathlib import Path
import re
import sys
import traceback

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BUILD = Path(os.getenv("AEVORA_TEST_BUILD_DIR", ROOT / ".ui-test-build"))
OUTPUT = Path(os.getenv("AEVORA_UI_REPORT_DIR", ROOT / "docs/optimization"))
OUTPUT.mkdir(parents=True, exist_ok=True)
HTML = (BUILD / "index.html").read_text().replace(
    '<link rel="stylesheet" href="styles.css">',
    '<style>' + (BUILD / "styles.css").read_text() + '</style>',
).replace('<script src="bundle.js"></script>', '')
BUNDLE = (BUILD / "bundle.js").read_text()
if (BUILD / "icon.png").exists():
    BUNDLE = BUNDLE.replace('/icon.png', 'data:image/png;base64,' + base64.b64encode((BUILD / "icon.png").read_bytes()).decode())
STORAGE = """() => {
 const data = new Map();
 Object.defineProperty(window, 'localStorage', {configurable:true, value:{
   getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,String(v)),
   removeItem:k=>data.delete(k), clear:()=>data.clear()
 }});
 if(!crypto.randomUUID) crypto.randomUUID=()=>Math.random().toString(36).slice(2);
}"""
LONG_MODEL = "a-very-long-model-name-for-responsive-layout-verification"
SESSIONS = [{"id": key, "title": title, "created_at": "2026-01-01", "updated_at": "2026-01-01", "message_count": 1}
            for key, title in [("a", "First conversation"), ("b", "Second conversation")]]
MESSAGES = {"a": [{"id": f"saved-{i}", "role": "model", "content": f"Saved answer {i}: **keep this history stable**.", "model_name": LONG_MODEL} for i in range(6)],
            "b": [{"id": "other", "role": "model", "content": "Second conversation loaded."}]}
RESULTS, METRICS, ERRORS = [], {}, {}


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def boot(browser, width=1360, height=900, options=None, query=""):
    page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="no-preference")
    page.set_default_timeout(6000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    ERRORS[page] = errors
    page.set_content(HTML)
    page.evaluate(STORAGE)
    page.evaluate("v => {window.__uiOptions=v.options;window.__fixtureQuery=v.query;}", {"options": options or {}, "query": query})
    page.add_script_tag(content=BUNDLE)
    if "view=orb" in query:
        page.wait_for_function("fixture.glDraws > 0")
    elif (options or {}).get('auth') is False or 'token=' in query:
        page.locator('.auth-title').wait_for()
    else:
        page.get_by_role('textbox', name='Message Aevora').wait_for()
    page.wait_for_timeout(150)
    check(not errors, f"Browser errors: {errors}")
    return page


def done(page):
    check(not ERRORS[page], f"Browser errors: {ERRORS[page]}")
    page.close()


def fits(page, locator, label):
    box = locator.bounding_box()
    check(box is not None and box['width'] > 0 and box['height'] > 0, f'{label} has no visible box')
    size = page.viewport_size
    check(box['x'] >= -1 and box['y'] >= -1 and box['x'] + box['width'] <= size['width'] + 1 and box['y'] + box['height'] <= size['height'] + 1, f'{label} outside viewport: {box}')


def send(page, text="Test prompt"):
    field = page.get_by_role('textbox', name='Message Aevora')
    field.fill(text)
    page.get_by_role('button', name='Send message', exact=True).click()
    page.wait_for_function('fixture.requests.length > 0')


def responsive(browser):
    for width, height in [(1360, 900), (390, 844), (320, 640), (667, 375)]:
        page = boot(browser, width, height, {"selectedModel": LONG_MODEL})
        for name in ['Send message', 'Switch AI model', 'Mention a connected tool']:
            fits(page, page.get_by_role('button', name=name, exact=True), name)
        if page.get_by_role('button', name='Start a voice conversation', exact=True).count():
            fits(page, page.get_by_role('button', name='Start a voice conversation', exact=True), 'Voice')
        field = page.get_by_role('textbox', name='Message Aevora')
        field.fill('A line\n' * 7)
        page.get_by_role('button', name='Switch AI model', exact=True).click()
        fits(page, page.locator('#chat-tools'), 'Model popup')
        page.keyboard.press('Escape')
        check(page.locator('#chat-tools').count() == 0, 'Escape did not close popup')
        check(field.evaluate('(el)=>el===document.activeElement'), 'Popup did not return focus to input')
        field.fill('')
        if width in [1360, 390]:
            page.screenshot(path=str(OUTPUT / f'chat-{width}.png'))
        done(page)


def input_keys(browser):
    page = boot(browser)
    field = page.get_by_role('textbox', name='Message Aevora')
    field.fill('Composing')
    field.dispatch_event('compositionstart')
    field.press('Enter')
    check(page.evaluate('fixture.requests.length') == 0, 'IME enter submitted')
    field.dispatch_event('compositionend')
    field.press('Shift+Enter')
    check('\n' in field.input_value(), 'Shift+Enter lost newline')
    field.press('Enter')
    page.wait_for_function('fixture.requests.length===1')
    page.get_by_role('button', name='Stop response', exact=True).click()
    page.evaluate("fixture.finish('A stale result')")
    page.wait_for_timeout(100)
    check('A stale result' not in page.locator('main').inner_text(), 'Stopped reply returned')
    done(page)


def stream_complete(browser):
    page = boot(browser)
    send(page)
    reply = 'A full response must survive transport completion. ' * 18
    page.evaluate('text => fixture.finish(text)', reply)
    page.wait_for_function("document.querySelector('main').textContent.includes('A full response') && !document.querySelector('[aria-label=\"Stop response\"]')")
    check(page.get_by_role('article', name='Aevora', exact=True).last.inner_text().count('transport completion.') == 18, 'Final reply was truncated')
    done(page)


def stable_history(browser):
    page = boot(browser, options={"sessions": SESSIONS, "messages": MESSAGES})
    send(page)
    page.wait_for_timeout(100)
    before = page.evaluate('({...fixture.renders})')
    for i in range(20):
        page.evaluate("fixture.stream.onChunk('x')")
        page.wait_for_timeout(35)
    after = page.evaluate('({...fixture.renders})')
    delta = {key: after[key] - before[key] for key in before}
    METRICS['stream_render_delta_20_chunks_6_saved_messages'] = delta
    for key in ['input', 'sidebar', 'nav', 'history', 'savedMarkdown']:
        check(delta[key] == 0, f'{key} rerendered for streaming characters: {delta[key]}')
    page.evaluate("fixture.finish(' Finished.')")
    page.get_by_role('button', name='Send message', exact=True).wait_for()
    page.screenshot(path=str(OUTPUT / 'history-desktop.png'))
    done(page)


def selection_race(browser):
    page = boot(browser, options={"sessions": SESSIONS, "messages": MESSAGES})
    page.evaluate("fixture.delayedSessions={a:true,b:true}")
    page.get_by_role('button', name='Second conversation', exact=True).click()
    page.get_by_role('button', name='First conversation', exact=True).click()
    page.evaluate("fixture.resolveSession('a',[{id:'new-a',role:'model',content:'Newest selection'}]);fixture.resolveSession('b',[{id:'late-b',role:'model',content:'Stale selection'}])")
    page.wait_for_function("document.querySelector('main').textContent.includes('Newest selection')")
    check('Stale selection' not in page.locator('main').inner_text(), 'Late selection won')
    page.get_by_role('button', name='Second conversation', exact=True).click()
    page.get_by_role('button', name='New conversation', exact=True).click()
    page.evaluate("fixture.resolveSession('b',[{id:'late-new',role:'model',content:'Stale new chat'}])")
    page.wait_for_timeout(100)
    check('Stale new chat' not in page.locator('main').inner_text(), 'Late history replaced new chat')
    done(page)


def delete_and_logout(browser):
    page = boot(browser, options={"sessions": SESSIONS[:1], "messages": MESSAGES})
    page.evaluate('fixture.deleteFails=true')
    page.get_by_role('button', name='Delete First conversation', exact=True).click()
    page.get_by_role('group', name='Confirm deletion').get_by_role('button', name='Delete', exact=True).click()
    page.get_by_role('alert').wait_for()
    check(page.get_by_role('button', name='First conversation', exact=True).count()==1, 'Failed deletion removed session')
    send(page)
    page.evaluate('fixture.deleteFails=false')
    page.get_by_role('button', name='Delete First conversation', exact=True).click()
    page.get_by_role('group', name='Confirm deletion').get_by_role('button', name='Delete', exact=True).click()
    page.wait_for_function('fixture.aborts===1')
    page.evaluate("fixture.finish('Deleted conversation reply')")
    check('Deleted conversation reply' not in page.locator('main').inner_text(), 'Deleted stream returned')
    send(page, 'Reply before logout')
    page.get_by_role('button', name='Sign out', exact=True).click()
    page.locator('.auth-title').wait_for()
    page.evaluate("fixture.finish('Signed out reply')")
    page.wait_for_timeout(100)
    check(page.locator('main').count()==0, 'Late reply restored signed-out chat')
    done(page)


def late_delete(browser):
    page = boot(browser, options={"sessions": SESSIONS, "messages": MESSAGES})
    page.evaluate('fixture.delayDelete=true')
    page.get_by_role('button', name='Delete First conversation', exact=True).click()
    page.get_by_role('group', name='Confirm deletion').get_by_role('button', name='Delete', exact=True).click()
    page.get_by_role('button', name='Second conversation', exact=True).click()
    page.evaluate('fixture.resolveDelete()')
    page.wait_for_function("document.querySelector('main').textContent.includes('Second conversation loaded.')")
    done(page)


def settings(browser):
    page = boot(browser)
    check(page.evaluate('fixture.settingsModuleLoads')==0, 'Settings evaluated before first open')
    page.get_by_role('button', name='Open settings', exact=True).click()
    dialog = page.get_by_role('dialog')
    dialog.wait_for()
    check(page.evaluate('fixture.dynamicLoads')==1, 'Lazy Settings loaded more than once')
    check('AI Engine & Performance Boost' in dialog.inner_text(), 'Default tab did not render')
    url = dialog.locator('input').first
    url.fill('http://localhost:9999')
    dialog.get_by_role('button', name='Done', exact=True).focus()
    page.keyboard.press('Tab')
    check(dialog.evaluate('(el)=>el.contains(document.activeElement)'), 'Tab escaped dialog')
    page.keyboard.press('Shift+Tab')
    check(dialog.evaluate('(el)=>el.contains(document.activeElement)'), 'Shift+Tab escaped dialog')
    page.keyboard.press('Escape')
    check(dialog.count()==0, 'Escape did not close settings')
    check(page.locator('#conversation-sidebar').count()==1, 'Escape also closed sidebar')
    check(page.get_by_role('button', name='Open settings', exact=True).evaluate('(el)=>el===document.activeElement'), 'Focus was not restored')
    page.get_by_role('button', name='Open settings', exact=True).click()
    check(page.get_by_role('dialog').locator('input').first.input_value()=='http://localhost:9999', 'Closing settings lost draft')
    check(page.evaluate('fixture.settingsModuleLoads')==1, 'Settings module evaluated twice')
    page.screenshot(path=str(OUTPUT / 'settings-desktop.png'))
    done(page)
    for width,height in [(390,844),(320,640),(667,375)]:
        page = boot(browser,width,height)
        page.get_by_role('button',name='Open settings',exact=True).click()
        dialog=page.get_by_role('dialog');dialog.wait_for()
        fits(page,dialog,'Settings dialog')
        fits(page,dialog.get_by_role('button',name='Close settings',exact=True),'Settings close')
        fits(page,dialog.get_by_role('button',name='Done',exact=True),'Settings done')
        content=dialog.locator('[class*="Settings_content"]')
        check(content.evaluate('(el)=>el.scrollWidth <= el.clientWidth+1'), 'Settings content has horizontal overflow')
        content.evaluate('(el)=>el.scrollTop=el.scrollHeight')
        check(content.locator('input').first.bounding_box() is not None, 'Connection field missing')
        if width==390:
            content.evaluate('(el)=>el.scrollTop=0')
            page.screenshot(path=str(OUTPUT/'settings-mobile.png'))
        done(page)


def auth_layout(browser):
    for width,height in [(320,640),(667,375)]:
        page=boot(browser,width,height,{"auth":False,"delayHealth":True})
        check(page.locator('.auth-title').inner_text()=='Sign in to Aevora', 'Health blocked login')
        title=page.locator('.auth-title');title.scroll_into_view_if_needed();fits(page,title,'Login heading')
        page.get_by_text('Create an account',exact=True).click()
        title=page.locator('.auth-title');title.scroll_into_view_if_needed();fits(page,title,'Register heading')
        submit=page.get_by_role('button',name='Create account',exact=True)
        submit.scroll_into_view_if_needed();fits(page,submit,'Register submit')
        page.screenshot(path=str(OUTPUT/f'auth-register-{width}.png'))
        done(page)
    page=boot(browser,390,844,{"auth":True},'?token=reset-fixture')
    check(page.locator('.auth-title').inner_text() == 'Choose a new password', 'Initialization overwrote reset link')
    check(page.get_by_role('textbox',name='Message Aevora').count()==0,'Reset link rendered authenticated chat')
    done(page)


def orb_retained(browser):
    page=boot(browser,query='?view=orb')
    initial=page.evaluate('({draws:fixture.glDraws,renders:fixture.orbRenders,created:fixture.glCreated})')
    page.wait_for_function('count => fixture.glDraws > count', arg=initial['draws'], timeout=15000)
    check(page.evaluate('fixture.orbRenders')==initial['renders'], 'Animation causes per-frame React renders')
    for theme in range(6):
        page.evaluate('theme=>fixture.renderOrb(165,theme)',theme)
        page.wait_for_function('theme => document.querySelector("[data-orb-theme]").dataset.orbTheme === String(theme)', arg=theme)
    check(page.evaluate('fixture.glCreated')==initial['created'], 'Theme change recreated GPU program')
    METRICS['orb']={'themes_checked':6,'programs':initial['created'],'draws':page.evaluate('fixture.glDraws')}
    page.screenshot(path=str(OUTPUT/'orb-rgb.png'))
    page.evaluate('fixture.unmount()')
    page.wait_for_timeout(50)
    check(page.evaluate('fixture.glDeleted')==initial['created'],'Orb GPU program not disposed')
    done(page)


def run():
    cases=[responsive,input_keys,stream_complete,stable_history,selection_race,delete_and_logout,late_delete,settings,auth_layout,orb_retained]
    with sync_playwright() as playwright:
        args={'headless':True,'args':['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
        executable=os.getenv('CHROMIUM_PATH')
        if executable: args['executable_path']=executable
        browser=playwright.chromium.launch(**args)
        selected = os.getenv('AEVORA_UI_CASES')
        if selected:
            cases = [case for case in cases if case.__name__ in selected.split(',')]
        for case in cases:
            # Some managed Chromium builds expose WebGL only in a headed X display.
            # Keep layout checks headless; verify the untouched real shader separately.
            if case is orb_retained and os.getenv('HEADED_ORB') == '1':
                browser.close()
                browser = playwright.chromium.launch(**{**args, 'headless':False})
            try:
                case(browser)
                RESULTS.append({'name':case.__name__,'status':'PASS'})
                print(f'PASS {case.__name__}',flush=True)
            except Exception as error:
                RESULTS.append({'name':case.__name__,'status':'FAIL','error':str(error)})
                print(f'FAIL {case.__name__}: {error}',flush=True)
                for context in browser.contexts:
                    for page in context.pages:
                        try: page.screenshot(path=str(OUTPUT/f'failure-{case.__name__}.png'))
                        except Exception: pass
                traceback.print_exc()
            finally:
                for context in browser.contexts: context.close()
        version=browser.version
        browser.close()
    report={'scope':'Real UI source; mocked API, storage, speech hardware and Electron bridge. Not a Next/Electron production build.',
            'browser':version,'orbHeaded':os.getenv('HEADED_ORB')=='1','build':json.loads((BUILD/'build-metadata.json').read_text()),'results':RESULTS,'metrics':METRICS}
    (OUTPUT/'browser-results.json').write_text(json.dumps(report,indent=2)+'\n')
    failures=sum(r['status']=='FAIL' for r in RESULTS)
    print(f'{len(RESULTS)-failures}/{len(RESULTS)} UI scenario groups passed. Report: {OUTPUT / "browser-results.json"}')
    return int(failures>0)


if __name__=='__main__':
    sys.exit(run())
