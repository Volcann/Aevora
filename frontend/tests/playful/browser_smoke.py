"""Real UI sources; API/native boundaries are explicit fixture doubles, no backend.

Build with npm run test:playful:fixture, then run this file. CHROMIUM_PATH can
select a local Chromium. The report records any compatibility-runtime override.
"""
from pathlib import Path
import json, os, re, traceback
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BUILD = Path(os.getenv('AEVORA_TEST_BUILD_DIR', ROOT / '.playful-test-build'))
OUT = Path(os.getenv('AEVORA_PLAY_REPORT_DIR', ROOT / 'docs/playful-verification'))
OUT.mkdir(parents=True, exist_ok=True)
RESULTS = []
HTML = (BUILD/'index.html').read_text().replace('<link rel="stylesheet" href="styles.css">', '<style>'+(BUILD/'styles.css').read_text()+'</style>').replace('<script src="bundle.js"></script>', '')
BUNDLE = (BUILD/'bundle.js').read_text()
# Some managed Chromium installations disallow all navigation, including localhost.
# Render inline without weakening browser policy; storage is an explicit test double.
STORAGE = """(initial) => {
 const data = new Map(Object.entries(initial||{}));
 Object.defineProperty(window, 'localStorage', {configurable:true,value:{
   getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),
   removeItem:k=>data.delete(k),clear:()=>data.clear()
 }});
 window.__storageSnapshot=()=>Object.fromEntries(data);
 if(!crypto.randomUUID)crypto.randomUUID=()=>Math.random().toString(36).slice(2);
}"""

def check(value, message):
    if not value: raise AssertionError(message)

def boot(browser, width=1360, height=900, options=None, query='', context=None):
    context = context or browser.new_context(viewport={'width':width,'height':height}, reduced_motion='no-preference')
    page = context.new_page()
    page.set_default_timeout(6500)
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page._play_errors=errors
    page.set_content(HTML)
    page.evaluate(STORAGE, (options or {}).get('initialStorage', {}))
    page.evaluate('(value)=>{window.__uiOptions=value.options;window.__fixtureQuery=value.query;}', {'options':{'pet':True, **(options or {})},'query':query})
    page.add_script_tag(content=BUNDLE)
    if 'view=pet' in query:
        page.get_by_role('button', name='Open companion chat', exact=True).wait_for()
    else:
        page.get_by_role('textbox', name='Message Aevora', exact=True).wait_for()
        page.locator('aside [data-play-mode]').wait_for()
    page.wait_for_timeout(180)
    check(not errors, 'Browser errors: '+str(errors))
    return page

def done(page):
    check(not page._play_errors, 'Browser errors: '+str(page._play_errors))
    page.context.close()

def setprefs(page, **values):
    page.evaluate('(patch)=>fixtureRequire("apps/web/components/orb/playful/usePlayPreferences").setPlayPreferences(patch)', values)
    page.wait_for_timeout(70)

def open_pet(page):
    handle = page.locator('aside [data-renderer] button')
    box = handle.bounding_box()
    page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
    handle.click()
    page.get_by_role('textbox', name='Message to companion').wait_for()

def show_controls(page):
    open_pet(page)
    page.get_by_role('button', name='Orb playground', exact=True).click()
    return page.get_by_role('region', name='Orb playground')

def close_pet(page):
    page.get_by_role('button', name=re.compile(r'^Minimize (?:voice )?companion$')).first.click()
    page.wait_for_timeout(100)

def send(page):
    page.get_by_role('textbox', name='Message Aevora', exact=True).fill('Inspect the workspace and show tool output.')
    page.get_by_role('button', name='Send message', exact=True).click()
    page.wait_for_function('fixture.requests.length > 0')

def loc(page): return page.locator('aside').filter(has=page.locator('[data-play-mode]'))
def position(page): return loc(page).evaluate('(el)=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)})')
def distance(a,b): return ((a['x']-b['x'])**2+(a['y']-b['y'])**2)**.5

def default_and_controls(browser):
    page=boot(browser)
    orb=page.locator('aside [data-play-mode]')
    check(orb.get_attribute('data-play-mode')=='classic','Default mode changed')
    check(orb.get_attribute('data-treatment')=='original','Default color changed')
    check(orb.get_attribute('data-morph')=='off','Idle orb is morphing')
    page.screenshot(path=str(OUT/'workspace-original.png'))
    controls=show_controls(page)
    for mode in ['Float','Bounce','Orbit','Sleepy','Classic']:
        controls.get_by_role('button',name=mode,exact=True).click()
        check(orb.get_attribute('data-play-mode')==mode.lower(),'Mode did not apply')
    controls.get_by_role('button',name='Moonstone',exact=True).click()
    check(orb.get_attribute('data-treatment')=='moonstone','Optional theme not applied')
    controls.get_by_role('button',name='Original look & motion',exact=True).click()
    check(orb.get_attribute('data-treatment')=='original','Reset changed original theme')
    check(page.evaluate('fixture.requests.length')==0,'Play controls issued chat request')
    page.screenshot(path=str(OUT/'playground-controls.png'))
    done(page)

def drag_and_keyboard(browser):
    page=boot(browser)
    handle=page.locator('aside [data-renderer] button')
    b=handle.bounding_box();start=position(page)
    page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);page.mouse.down()
    page.mouse.move(700,420,steps=8);page.mouse.up();page.wait_for_timeout(650)
    check(not page.get_by_role('textbox',name='Message to companion').is_visible(),'Dragging opened companion')
    check(distance(start,position(page))>60,'Drag/fling did not move')
    page.wait_for_timeout(1600)
    handle.focus();handle.press('ArrowLeft');a=position(page);handle.press('ArrowRight');b=position(page)
    check(abs(b['x']-a['x']-16)<.5,'Keyboard movement is not 16px')
    handle.press('Home');page.wait_for_timeout(100)
    check(distance(position(page),{'x':1260,'y':790})<1,'Home did not restore position')
    # Holding after a drag must not launch the stale velocity on release.
    box=handle.bounding_box();page.mouse.move(box['x']+40,box['y']+40);page.mouse.down();page.mouse.move(960,500,steps=8);page.wait_for_timeout(180)
    at=position(page);page.mouse.up();page.wait_for_timeout(500)
    check(distance(at,position(page))<1,'Stale drag velocity caused a fling')
    # Pointer cancellation must release safely without a click or inertia.
    handle.dispatch_event('pointerdown',{'pointerId':99,'isPrimary':True,'button':0,'clientX':900,'clientY':480})
    handle.dispatch_event('pointermove',{'pointerId':99,'isPrimary':True,'button':0,'clientX':700,'clientY':380})
    at=position(page)
    handle.dispatch_event('pointercancel',{'pointerId':99,'isPrimary':True,'button':0,'clientX':700,'clientY':380})
    page.wait_for_timeout(220)
    check(distance(at,position(page))<1,'Cancelled pointer flung the orb')
    done(page)

def roaming_and_follow(browser):
    page=boot(browser)
    setprefs(page,mode='roam')
    a=position(page);page.wait_for_timeout(650);check(distance(a,position(page))>5,'Roam did not move')
    open_pet(page);a=position(page);page.wait_for_timeout(500);check(distance(a,position(page))<1,'Travel continued with panel open')
    close_pet(page)
    setprefs(page,mode='follow');page.mouse.move(220,190);a=position(page);page.wait_for_timeout(800)
    b=position(page);check(distance(a,b)>10,'Follow did not respond to pointer')
    check(distance({'x':b['x']+40,'y':b['y']+40},{'x':220,'y':190})>100,'Orb covered pointer')
    page.get_by_role('textbox',name='Message Aevora',exact=True).fill('Typing pauses roaming')
    setprefs(page,mode='roam')
    page.get_by_role('textbox',name='Message Aevora',exact=True).press('x')
    a=position(page);page.wait_for_timeout(400);check(distance(a,position(page))<1,'Typing did not pause travel')
    setprefs(page,mode='classic');done(page)

def reduced_and_native_pause(browser):
    page=boot(browser)
    setprefs(page,mode='roam');page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(120)
    a=position(page);page.wait_for_timeout(400);check(distance(a,position(page))<1,'Reduced motion did not stop travel')
    check(page.locator('aside [data-animated]').get_attribute('data-animated')=='false','Reduced motion not reflected')
    page.emulate_media(reduced_motion='no-preference');page.wait_for_timeout(100)
    page.evaluate('fixture.setNativeActive(false)');page.wait_for_timeout(100)
    a=position(page);page.wait_for_timeout(350);check(distance(a,position(page))<1,'Inactive native renderer still travels')
    page.evaluate('fixture.setNativeActive(true)');page.wait_for_timeout(400);check(distance(a,position(page))>3,'Native resume failed')
    done(page)

def streaming_shapes(browser):
    page=boot(browser)
    send(page)
    orb=page.locator('aside [data-play-mode]')
    page.wait_for_function('document.querySelector("aside [data-morph]").dataset.morph==="fluid"')
    page.evaluate('fixture.stream.onChunk("Here is the first part of the response, streaming into chat.")')
    page.wait_for_function('document.querySelector("aside [data-streaming]").dataset.streaming==="responding"')
    for shape in ['fluid','pulse','elastic','ribbon','off']:
        setprefs(page,morph=shape)
        check(orb.get_attribute('data-morph')==shape,'Streaming shape did not apply: '+shape)
    setprefs(page,morph='fluid')
    check(orb.locator('feDisplacementMap').count()==1,'Fluid deformation filter missing')
    page.screenshot(path=str(OUT/'streaming-orb.png'))
    page.evaluate('fixture.finish(" A completed answer.")')
    page.wait_for_function('document.querySelector("aside [data-streaming]").dataset.streaming==="idle"')
    check(orb.get_attribute('data-morph')=='off','Orb failed to return to its original idle shape')
    check(orb.locator('filter[id^="orb-fluid-"]').count()==0,'Streaming filter leaked after completion')
    done(page)

def terminal_live(browser):
    page=boot(browser)
    send(page)
    logs=['$ npm run check-types','INFO Reading workspace configuration…','\x1b[32m✓ Completed type analysis\x1b[0m','WARNING One optional integration is unavailable','<img src=x onerror="window.__terminalInjected=true">']
    page.evaluate('(lines)=>{fixture.stream.onToolStart("workspace.shell");for(const line of lines)fixture.stream.onToolLog(line,"workspace.shell");}',logs)
    terminal=page.locator('[data-terminal-status]')
    terminal.wait_for();check(terminal.get_attribute('data-terminal-status')=='running','Wrong live tool status')
    page.evaluate('fixture.stream.onChunk("The checks are complete. Here is what I found.")')
    page.wait_for_timeout(600)
    check(terminal.is_visible(),'Terminal disappeared when response text arrived')
    check(terminal.locator('img,script').count()==0,'Log text became markup')
    check(not page.evaluate('!!window.__terminalInjected'),'Log text executed')
    terminal.get_by_role('button',name='Search logs',exact=True).click()
    terminal.get_by_role('textbox',name='Filter terminal output',exact=True).fill('WARNING')
    check(terminal.locator('[data-kind]').count()==1,'Search did not filter rows')
    terminal.get_by_role('button',name='Close log search',exact=True).click()
    check(terminal.locator('[data-tone="green"]').count()>0,'ANSI color not rendered')
    page.evaluate('Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async value=>{window.__copied=value}}})')
    terminal.get_by_role('button',name='Copy logs',exact=True).click()
    page.wait_for_function('!!window.__copied')
    check('npm run check-types' in page.evaluate('window.__copied'),'Copy omitted logs')
    check('\x1b' not in page.evaluate('window.__copied'),'Copy retained escape codes')
    with page.expect_download() as download:
        terminal.get_by_role('button',name='Download logs',exact=True).click()
    check(download.value.suggested_filename=='workspace-shell.log','Bad download filename')
    terminal.get_by_role('button',name='Wrap lines',exact=True).click()
    check(terminal.locator('[data-wrap]').get_attribute('data-wrap')=='false','Line wrapping did not toggle')
    page.screenshot(path=str(OUT/'terminal-live.png'))
    page.evaluate('fixture.stream.onToolDone("workspace.shell","Done")');page.wait_for_timeout(90)
    check(terminal.get_attribute('data-terminal-status')=='done','Finished status not shown')
    page.evaluate('fixture.finish(" Final answer.")')
    page.get_by_role("article",name="Aevora is replying",exact=True).wait_for(state="hidden")
    saved=page.locator('[data-terminal-status="saved"]');check(saved.count()==1,'Saved terminal output missing')
    check(saved.locator('[aria-expanded]').get_attribute('aria-expanded')=='false','Saved output not collapsed')
    saved.locator('[aria-expanded]').click();check(saved.get_by_role('region',name='Terminal output').is_visible(),'Saved output cannot be reopened')
    done(page)

def terminal_follow_and_limits(browser):
    page=boot(browser)
    send(page)
    page.evaluate('()=>{fixture.stream.onToolStart("long-running-tool");fixture.stream.onToolLog(Array.from({length:220},(_,i)=>"line "+i).join("\\n"));}')
    pane=page.get_by_role('region',name='Terminal output',exact=True);pane.wait_for()
    pane.evaluate('(el)=>{el.scrollTop=0;el.dispatchEvent(new Event("scroll",{bubbles:true}));}')
    page.wait_for_timeout(70)
    page.evaluate('fixture.stream.onToolLog("New output while reading history")');page.wait_for_timeout(150)
    check(pane.evaluate('(el)=>el.scrollTop')<2,'New output stole scroll position')
    page.get_by_role('button',name='Follow terminal output',exact=True).click()
    check(pane.evaluate('(el)=>el.scrollHeight-el.scrollTop-el.clientHeight')<4,'Follow did not reach bottom')
    page.evaluate('fixture.stream.onToolLog(Array.from({length:6000},(_,i)=>"retained line "+i).join("\\n"))')
    page.wait_for_timeout(180)
    check(page.locator('[data-kind]').count()<=1200,'Too many terminal DOM rows')
    check('Showing recent output only' in page.locator('[data-terminal-status]').inner_text(),'Missing truncation disclosure')
    page.evaluate('Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async()=>{throw new Error("denied")}}})')
    page.get_by_role('button',name='Copy logs',exact=True).click()
    page.get_by_text('Clipboard unavailable. Select the output to copy it.',exact=True).wait_for()
    done(page)

def responsive(browser):
    for width,height in [(390,844),(320,640),(667,375)]:
        page=boot(browser,width,height)
        controls=show_controls(page)
        panel=page.locator('aside section').first
        b=panel.bounding_box()
        check(b['x']>=-1 and b['y']>=-1 and b['x']+b['width']<=width+1 and b['y']+b['height']<=height+1,f'Companion panel out of bounds at {width}x{height}: {b}')
        close_pet(page);send(page)
        page.evaluate('fixture.stream.onToolStart("tool_with_a_very_long_descriptive_name");fixture.stream.onToolLog("A very long output line "+"x".repeat(1000))')
        page.wait_for_timeout(180)
        terminal=page.locator('[data-terminal-status]');b=terminal.bounding_box()
        check(b['x']>=-1 and b['x']+b['width']<=width+1,f'Terminal overflows at width {width}: {b}')
        check(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Document overflow')
        page.screenshot(path=str(OUT/f'responsive-{width}x{height}.png'))
        done(page)

def storage_sync(browser):
    page=boot(browser)
    setprefs(page,mode='float',treatment='candy')
    saved=page.evaluate('window.__storageSnapshot()')
    other=boot(browser,options={'initialStorage':saved})
    other.locator('aside [data-play-mode="float"]').wait_for()
    check(other.locator('aside [data-treatment]').get_attribute('data-treatment')=='candy','Preferences did not round-trip through storage')
    # Explicitly deliver the same-origin browser storage event across fixture pages.
    setprefs(page,mode='bounce')
    value=page.evaluate('localStorage.getItem("aevora-orb-play-v1")')
    other.evaluate('(value)=>{localStorage.setItem("aevora-orb-play-v1",value);window.dispatchEvent(new StorageEvent("storage",{key:"aevora-orb-play-v1",newValue:value}));}',value)
    other.locator('aside [data-play-mode="bounce"]').wait_for()
    other.evaluate('localStorage.setItem("aevora-orb-play-v1","broken json");window.dispatchEvent(new StorageEvent("storage",{key:"aevora-orb-play-v1",newValue:"broken json"}));')
    other.locator('aside [data-play-mode="classic"]').wait_for()
    page.evaluate('() => {localStorage.setItem=()=>{throw new Error("blocked")};}')
    setprefs(page,mode='orbit')
    check(page.locator('aside [data-play-mode]').get_attribute('data-play-mode')=='orbit','Blocked storage lost in-memory settings')
    done(other);done(page)

def native_companion(browser):
    page=boot(browser,query='?view=pet',width=320,height=440)
    setprefs(page,mode='roam')
    count=page.evaluate('fixture.nativeCalls.filter(x=>x.command==="nudge_pet_window").length')
    page.wait_for_timeout(650)
    check(page.evaluate('fixture.nativeCalls.filter(x=>x.command==="nudge_pet_window").length')>count,'Native Roam did not reuse existing movement IPC')
    page.get_by_role('button',name='Open companion chat',exact=True).click()
    page.get_by_role('button',name='Open orb playground',exact=True).click()
    page.get_by_role('region',name='Orb playground').wait_for()
    check(page.get_by_role('button',name='Follow',exact=True).is_disabled(),'Native follow should not imply global pointer tracking')
    count=page.evaluate('fixture.nativeCalls.filter(x=>x.command==="nudge_pet_window").length');page.wait_for_timeout(450)
    check(page.evaluate('fixture.nativeCalls.filter(x=>x.command==="nudge_pet_window").length')==count,'Native panel did not pause travel')
    page.get_by_role('button',name='Close orb playground',exact=True).click()
    page.get_by_role('textbox',name='Message to companion',exact=True).fill('Hello companion')
    page.get_by_role('button',name='Send to companion',exact=True).click()
    page.wait_for_function('fixture.requests.length>0')
    page.evaluate('fixture.stream.onChunk("A native companion response.")')
    page.wait_for_function('document.querySelector("[data-morph]").dataset.morph==="fluid"')
    page.screenshot(path=str(OUT/'native-companion.png'))
    done(page)

def settings_preview_and_tricks(browser):
    page=boot(browser)
    # Open the real settings surface via the existing nav entry.
    page.get_by_role('button', name='Account settings', exact=True).click()
    tab=page.get_by_role('button',name=re.compile(r'Companion'))
    tab.last.click()
    page.get_by_role('button',name='Preview streaming shape',exact=True).click()
    page.get_by_role('img',name='Orb appearance preview',exact=True).wait_for()
    page.get_by_role('button',name='Hop',exact=True).click()
    check(page.locator('[data-trick="hop"]').count()>0,'Trick did not fire')
    page.wait_for_timeout(1600)
    check(page.locator('[data-trick="hop"]').count()==0,'Trick did not clear')
    page.screenshot(path=str(OUT/'settings-playground.png'))
    check(page.evaluate('fixture.requests.length')==0,'Preview sent a real prompt')
    done(page)

TESTS=[default_and_controls,drag_and_keyboard,roaming_and_follow,reduced_and_native_pause,streaming_shapes,terminal_live,terminal_follow_and_limits,responsive,storage_sync,native_companion,settings_preview_and_tricks]
if __name__=='__main__':
    try:
        with sync_playwright() as p:
            options={'headless':True,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
            if os.getenv('CHROMIUM_PATH'): options['executable_path']=os.environ['CHROMIUM_PATH']
            browser=p.chromium.launch(**options)
            for test in TESTS:
                try:
                    test(browser);RESULTS.append({'test':test.__name__,'passed':True});print('PASS',test.__name__,flush=True)
                except Exception as exc:
                    RESULTS.append({'test':test.__name__,'passed':False,'error':str(exc)});print('FAIL',test.__name__,str(exc),flush=True);traceback.print_exc()
                    for context in browser.contexts: context.close()
            version=browser.version;browser.close()
    finally:
        metadata=json.loads((BUILD/'build-metadata.json').read_text())
        (OUT/'browser-results.json').write_text(json.dumps({'browser':locals().get('version'),'fixture':metadata,'scope':'Real application UI; API/native/storage test doubles; inline Chromium fixture, not a production Next/Electron build.','results':RESULTS},indent=2))
    raise SystemExit(0 if all(r['passed'] for r in RESULTS) else 1)
