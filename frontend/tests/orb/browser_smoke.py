"""Regression fixture: actual React/UI/WebGL, mocked API/STT/TTS/native IPC.

The input-energy test uses a real WebAudio analyser fed by a synthetic tone.
No real microphone, model service, OS window manager or native executable is used.
Build the fixture first. Install Playwright and Chromium before running.
On Linux without a display: xvfb-run -a python tests/orb/browser_smoke.py
"""
from __future__ import annotations
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[2]
BUILD = Path(os.environ.get("ORB_BROWSER_OUTPUT", ROOT / ".orb-test-build"))
RESULTS = Path(os.environ.get("ORB_RESULTS_DIR", ROOT / "test-results" / "orb"))
RESULTS.mkdir(parents=True, exist_ok=True)
reports, errors = [], []
html = BUILD.joinpath("index.html").read_text().replace('<link rel="stylesheet" href="orb.css">', '<style>' + BUILD.joinpath("orb.css").read_text() + '</style>').replace('<script src="bundle.js"></script>', '')
bundle = BUILD.joinpath("bundle.js").read_text()

def check(name, operation):
    try:
        operation(); reports.append({"name": name, "status": "passed"}); print("PASS", name, flush=True)
    except Exception as error:
        reports.append({"name": name, "status": "failed", "error": str(error)}); print("FAIL", name, str(error), flush=True)

def eq(actual, expected):
    assert actual == expected, f"Expected {expected!r}, got {actual!r}"

def fits(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "Horizontal viewport overflow"

with sync_playwright() as p:
    launch = {"headless": True, "args": ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"]}
    if os.environ.get("CHROMIUM_PATH"): launch["executable_path"] = os.environ["CHROMIUM_PATH"]
    browser = p.chromium.launch(**launch)
    def load(*, view="chat", native=False, unsupported=False, fallback=False, audio=False, width=1440, height=960):
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
        page.set_default_timeout(6500)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.set_content(html)
        page.evaluate("""flags=>{
          Object.assign(window,flags);
          const storage=new Map([['aevora-pet-enabled','false']]);
          Object.defineProperty(window,'localStorage',{value:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},configurable:true});
          if(!crypto.randomUUID)crypto.randomUUID=()=>Math.random().toString(36).slice(2);
        }""", {"__orbView":view,"__orbNative":native,"__orbUnsupportedSpeech":unsupported,"__orbForceNoWebGL":fallback,"__orbRealAnalyser":audio})
        page.add_script_tag(content=bundle)
        page.wait_for_function("window.fixture && document.querySelector('[data-orb-state]')")
        return page
    page = load()
    version = page.evaluate("__orbReactVersion")
    check("original WebGL shader compiles and renders", lambda: (expect(page.locator('[data-renderer="webgl"]')).to_have_count(1), page.wait_for_function("fixture.glDraws > 1")))
    check("main chat mounts without acquiring microphone", lambda: eq(page.evaluate("fixture.microphones"),0))
    check("desktop chat is within viewport", lambda: fits(page))
    page.screenshot(path=str(RESULTS/"chat-desktop.png"))

    def open_keyboard():
        page.get_by_role("button",name="Open voice call",exact=True).focus();page.keyboard.press("Enter")
        expect(page.get_by_role("dialog")).to_be_visible()
        assert page.evaluate("document.querySelector('dialog').contains(document.activeElement)")
        eq(page.evaluate("fixture.microphones"),0)
    check("keyboard opens call dialog without automatic recording",open_keyboard)
    dialog=page.get_by_role("dialog")
    def themes():
        dialog.get_by_role("button",name="Voice and orb settings",exact=True).click()
        created=page.evaluate("fixture.glCreated")
        for index,name in enumerate(["Apple Intelligence","Siri Classic","Aevora Emerald","Cyberpunk","Cosmic"]):
            dialog.get_by_role("button",name=name,exact=True).click()
            expect(dialog.locator('[data-orb-theme]')).to_have_attribute("data-orb-theme",str(index))
        eq(page.evaluate("fixture.glCreated"),created)
        dialog.get_by_role("button",name="Siri Classic",exact=True).click()
        dialog.get_by_role("button",name="Voice and orb settings",exact=True).click()
    check("all five original themes switch without recreating GPU programs",themes)
    page.screenshot(path=str(RESULTS/"voice-call-desktop.png"))
    def frames():
        page.wait_for_timeout(100);renders,draws=page.evaluate("[fixture.visualRenders,fixture.glDraws]")
        page.wait_for_timeout(350)
        assert page.evaluate("fixture.glDraws")>draws
        eq(page.evaluate("fixture.visualRenders"),renders)
    check("orb animation does not rerender React at frame rate",frames)
    def call():
        dialog.get_by_role("button",name="Start voice call",exact=True).last.click()
        expect(dialog.locator('[data-orb-state]')).to_have_attribute("data-orb-state","1")
        eq(page.evaluate("fixture.microphones"),1)
        expect(dialog.get_by_role("button",name="End voice call",exact=True)).to_be_visible()
    check("explicit call action starts capture and live listening state",call)
    def mute():
        page.evaluate("fixture.recognitions.at(-1).result('An unfinished thought')")
        dialog.get_by_role("button",name="Mute microphone",exact=True).click()
        expect(dialog.locator('[data-orb-state]')).to_have_attribute("data-orb-state","0")
        eq(page.evaluate("fixture.prompts.length"),0)
        eq(page.evaluate("fixture.stoppedTracks"),1)
        dialog.get_by_role("button",name="Unmute microphone",exact=True).click()
        expect(dialog.locator('[data-orb-state]')).to_have_attribute("data-orb-state","1")
        eq(page.evaluate("fixture.microphones"),2)
    check("microphone mute releases capture; unmute resumes without sending partial text",mute)
    def response():
        page.evaluate("fixture.recognitions.at(-1).result('Help me plan my afternoon')")
        dialog.get_by_role("button",name="Send voice prompt",exact=True).click()
        expect(dialog.locator('[data-orb-state]')).to_have_attribute("data-orb-state","2")
        page.evaluate("fixture.finishReply('Of course. Let’s start with the one thing that matters most.')")
        expect(dialog.locator('[data-orb-state]')).to_have_attribute("data-orb-state","2")
        page.evaluate("fixture.speakStart()")
        expect(dialog.locator('[data-orb-state]')).to_have_attribute("data-orb-state","3")
        expect(dialog.get_by_text("Help me plan my afternoon",exact=True)).to_be_visible()
        page.evaluate("fixture.utterances.at(-1).onboundary?.({name:'word',charIndex:0,charLength:2})")
    check("captions track the turn; speaking starts only on actual playback event",response)
    def interrupt():
        before=page.evaluate("fixture.microphones")
        dialog.get_by_role("button",name="Interrupt and listen",exact=True).click()
        expect(dialog.locator('[data-orb-state]')).to_have_attribute("data-orb-state","1")
        eq(page.evaluate("fixture.microphones"),before+1)
        assert page.evaluate("fixture.speechCancels")>0
    check("tap-to-interrupt cancels output and starts a new listening turn",interrupt)
    def hangup():
        before=page.evaluate("fixture.microphones")
        dialog.get_by_role("button",name="End voice call",exact=True).click()
        expect(dialog).not_to_be_visible();page.wait_for_timeout(500)
        eq(page.evaluate("fixture.microphones"),before)
        eq(page.evaluate("fixture.stoppedTracks"),before)
    check("hang-up closes call and cannot restart microphone",hangup)
    def late_request():
        field=page.get_by_role("textbox",name="Message Aevora",exact=True)
        field.fill("First request");field.press("Enter")
        expect(page.get_by_role("button",name="Stop response",exact=True)).to_be_visible()
        field.fill("My next draft")
        request_count=page.evaluate("fixture.requests.length")
        page.evaluate("fixture.stoppedRequest=fixture.requests.at(-1)")
        page.get_by_role("button",name="Stop response",exact=True).click()
        eq(page.evaluate("fixture.requests.length"), request_count)
        page.evaluate("fixture.stoppedRequest.callbacks.onChunk('STALE REPLY');fixture.stoppedRequest.callbacks.onDone()")
        expect(page.get_by_text("STALE REPLY",exact=True)).to_have_count(0)
        expect(field).to_have_value("My next draft")
        assert page.evaluate("fixture.aborts")>=1
    check("stop cancels main chat and rejects late callbacks while preserving draft",late_request)
    def tools():
        page.get_by_role("button",name="Mention a connected tool",exact=True).click()
        expect(page.get_by_text("No tools are available. Refresh connected tools in Settings.",exact=True)).to_be_visible()
        page.get_by_role("textbox",name="Message Aevora",exact=True).press("Escape")
        expect(page.locator('#chat-tools')).to_have_count(0)
    check("tool picker does not invent unavailable backend tools",tools)
    def ime():
        field=page.get_by_role("textbox",name="Message Aevora",exact=True);field.fill("Composition in progress")
        before=page.evaluate("fixture.prompts.length")
        field.dispatch_event("compositionstart")
        field.dispatch_event("keydown",{"key":"Enter","code":"Enter","isComposing":True})
        eq(page.evaluate("fixture.prompts.length"),before)
        field.dispatch_event("compositionend")
    check("IME Enter does not accidentally submit a message",ime)
    def permission_close():
        page.get_by_role("button",name="Open voice call",exact=True).click()
        page.evaluate("fixture.delayPermission=true")
        dialog.get_by_role("button",name="Start voice call",exact=True).last.click()
        page.wait_for_function("typeof fixture.grantPermission==='function'")
        dialog.get_by_role("button",name="Close voice mode",exact=True).click()
        before=page.evaluate("fixture.stoppedTracks")
        page.evaluate("fixture.grantPermission();fixture.delayPermission=false")
        page.wait_for_function("fixture.stoppedTracks > "+str(before))
    check("closing pending microphone permission releases the eventual stream",permission_close)
    page.close()

    mobile=load(width=390,height=844)
    check("mobile chat keeps composer on screen without horizontal overflow",lambda:(fits(mobile),expect(mobile.get_by_role("textbox",name="Message Aevora")).to_be_in_viewport()))
    mobile.screenshot(path=str(RESULTS/"chat-mobile.png"))
    mobile.get_by_role("button",name="Open voice call",exact=True).click()
    mobile_dialog=mobile.get_by_role("dialog")
    check("mobile call controls remain reachable with transcript open",lambda:(fits(mobile),expect(mobile_dialog.get_by_role("button",name="Start voice call",exact=True).last).to_be_in_viewport()))
    mobile.screenshot(path=str(RESULTS/"voice-call-mobile.png"))
    mobile.keyboard.press("Escape")
    check("Escape closes native dialog and restores focus",lambda:(expect(mobile_dialog).not_to_be_visible(),expect(mobile.get_by_role("button",name="Open voice call",exact=True)).to_be_focused()))
    mobile.close()

    visual=load(view="visual",width=700,height=700)
    def motion():
        visual.emulate_media(reduced_motion="reduce");visual.wait_for_timeout(180)
        before=visual.evaluate("fixture.glDraws");visual.wait_for_timeout(250);eq(visual.evaluate("fixture.glDraws"),before)
        visual.evaluate("fixture.setTheme(4)");visual.wait_for_timeout(120);assert visual.evaluate("fixture.glDraws")>before
        visual.emulate_media(reduced_motion="no-preference")
    check("reduced motion freezes animation while preserving theme updates",motion)
    def hidden():
        visual.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        before=visual.evaluate("fixture.glDraws");visual.wait_for_timeout(250);eq(visual.evaluate("fixture.glDraws"),before)
        visual.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))")
    check("hidden tabs pause the graphics loop",hidden)
    def context_loss():
        visual.evaluate("const c=document.querySelector('canvas');window.testGL=c.getContext('webgl');window.lose=testGL.getExtension('WEBGL_lose_context');lose.loseContext()")
        expect(visual.locator('[data-renderer="fallback"]')).to_have_count(1)
        visual.wait_for_timeout(200);visual.evaluate("lose.restoreContext()")
        expect(visual.locator('[data-renderer="webgl"]')).to_have_count(1)
    check("WebGL context loss shows fallback and restores original shader",context_loss)
    def dispose():
        visual.evaluate("fixture.unmount()")
        eq(visual.evaluate("fixture.glDeleted"),visual.evaluate("fixture.glCreated"))
    check("unmount releases all created WebGL programs",dispose)
    visual.close()

    fallback=load(view="visual",fallback=True,width=480,height=600)
    check("WebGL unavailable retains visible keyboard-operable fallback",lambda:(expect(fallback.locator('[data-renderer="fallback"]')).to_have_count(1),expect(fallback.get_by_role("button",name="Test orb")).to_be_visible()))
    fallback.screenshot(path=str(RESULTS/"orb-fallback.png"));fallback.close()

    pet=load(view="pet",native=True,width=168,height=190)
    check("native companion starts compact with transparent background",lambda:(fits(pet),eq(pet.evaluate("fixture.nativeCalls[0].args"),{"width":168,"height":190}),eq(pet.evaluate("getComputedStyle(document.body).backgroundColor"),"rgba(0, 0, 0, 0)")))
    pet.screenshot(path=str(RESULTS/"companion-compact.png"),omit_background=True)
    def expand():
        pet.get_by_role("button",name="Open companion chat",exact=True).click()
        pet.wait_for_function("fixture.nativeCalls.some(c=>c.command==='resize_pet_window'&&c.args.width===360&&c.args.height===552)")
        pet.set_viewport_size({"width":360,"height":552})
        expect(pet.get_by_role("textbox",name="Message to companion",exact=True)).to_be_visible();fits(pet)
    check("companion expands through typed native resize command",expand)
    pet.screenshot(path=str(RESULTS/"companion-expanded.png"),omit_background=True)
    def window_controls():
        pet.get_by_role("button",name="Unpin companion",exact=True).click()
        pet.get_by_role("button",name="Open main chat",exact=True).click()
        grip=pet.get_by_role("button",name="Drag companion window",exact=True);grip.focus();grip.press("ArrowRight")
        grip.dispatch_event("pointerdown",{"button":0})
        commands=pet.evaluate("fixture.nativeCalls.map(c=>c.command)")
        for command in ["set_pet_pinned","focus_main_window","nudge_pet_window","start_dragging_pet"]:assert command in commands
    check("pin, focus-main, drag and keyboard movement invoke native controls",window_controls)
    def native_hide():
        pet.get_by_role("button",name="Start companion call",exact=True).click()
        expect(pet.locator('[data-orb-state]')).to_have_attribute("data-orb-state","1")
        pet.evaluate("fixture.emitNative('pet-visibility-changed',false)")
        expect(pet.locator('[data-orb-state]')).to_have_attribute("data-orb-state","0")
        eq(pet.evaluate("fixture.stoppedTracks"),1)
    check("native hidden-window notification ends call and releases microphone",native_hide)
    def close_pet():
        pet.get_by_role("button",name="Minimize companion",exact=True).click()
        pet.set_viewport_size({"width":168,"height":190})
        pet.get_by_role("button",name="Hide desktop companion",exact=True).click()
        assert pet.evaluate("fixture.nativeCalls.some(c=>c.command==='close_pet_window')")
    check("compact close invokes native hide instead of destroying state",close_pet)
    pet.close()

    unsupported=load(view="pet",native=True,unsupported=True,width=360,height=552)
    unsupported.get_by_role("button",name="Open companion chat",exact=True).click()
    def no_recognition():
        expect(unsupported.get_by_role("button",name="Start companion call",exact=True)).to_be_disabled()
        expect(unsupported.get_by_text("This webview does not support speech recognition. Text chat remains available.",exact=True)).to_be_visible()
        field=unsupported.get_by_role("textbox",name="Message to companion",exact=True);field.fill("A text-only question");unsupported.get_by_role("button",name="Send to companion",exact=True).click()
        unsupported.evaluate("fixture.finishReply('Text still works here.')")
        expect(unsupported.get_by_text("Text still works here.",exact=True)).to_be_visible()
        eq(unsupported.evaluate("fixture.microphones"),0)
    check("unsupported native recognition is honest and text chat still works",no_recognition)
    unsupported.close()

    audio=load(audio=True,width=1100,height=900)
    audio.get_by_role("button",name="Open voice call",exact=True).click()
    aud=audio.get_by_role("dialog")
    def real_analyser():
        aud.get_by_role("button",name="Start voice call",exact=True).last.click()
        expect(aud.locator('[data-orb-state]')).to_have_attribute("data-orb-state","1")
        audio.wait_for_timeout(120)
        assert float(aud.locator('[data-audio-level]').get_attribute('data-audio-level'))<.04
        before=audio.evaluate("fixture.visualRenders")
        audio.evaluate("fixture.setVolume(.35)")
        audio.wait_for_function("+document.querySelector('dialog [data-audio-level]').dataset.audioLevel > .15")
        assert audio.evaluate("Math.abs(parseFloat(getComputedStyle(document.querySelector('dialog [data-audio-level]')).getPropertyValue('--orb-vibration-x'))) > 0")
        eq(audio.evaluate("fixture.visualRenders"),before)
        audio.evaluate("fixture.setVolume(0)")
        audio.wait_for_function("+document.querySelector('dialog [data-audio-level]').dataset.audioLevel < .04")
        aud.get_by_role("button",name="End voice call",exact=True).click()
        eq(audio.evaluate("fixture.stoppedTracks"),1)
    check("real WebAudio energy drives vibration; silence settles without React frame updates",real_analyser)
    audio.close()
    check("no uncaught browser exceptions across tested screens",lambda:eq(errors,[]))
    result={"reactVersion":version,"environment":"Isolated compatibility fixture; real DOM/WebGL/WebAudio; mocked API, speech services and native IPC", "checks":reports,"browserErrors":errors,"passed":sum(r['status']=='passed' for r in reports),"failed":sum(r['status']=='failed' for r in reports)}
    (RESULTS/"browser-results.json").write_text(json.dumps(result,indent=2))
    browser.close()
    print(json.dumps({"passed":result['passed'],"failed":result['failed'],"reactVersion":version}),flush=True)
    if result['failed']:raise SystemExit(1)
