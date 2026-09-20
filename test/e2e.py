import asyncio, subprocess, sys
from playwright.async_api import async_playwright
proc = subprocess.Popen(['node','test/e2e-server.js'], stdout=subprocess.PIPE, text=True, cwd='/home/claude/checkup')
line = proc.stdout.readline().strip(); _, app, site = line.split()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1280,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{app}/'); await pg.wait_for_timeout(600)
        print('url input visible:', await pg.is_visible('#q-a'), '| note visible:', await pg.locator('.note').count())
        # URL analysis
        await pg.fill('#q-a', f'http://127.0.0.1:{site}/'); await pg.click('#go'); await pg.wait_for_selector('.score', timeout=15000)
        print('live score:', (await pg.inner_text('.score')).replace('\n',''), '| pages rows:', await pg.locator('.tbl tbody tr').count())
        await pg.click('#btn-back')
        # name search
        await pg.fill('#q-a', 'Acme'); await pg.click('#go'); await pg.wait_for_selector('.cand', timeout=8000)
        print('candidates:', await pg.locator('.cand').count())
        await pg.click('#go'); await pg.wait_for_selector('.score', timeout=15000)
        print('with gbp section:', await pg.locator('text=Προφίλ Google Business').count())
        await pg.screenshot(path='test/e2e-gbp.png', full_page=True)
        await pg.click('#btn-back')
        # gbp-only (second candidate)
        await pg.fill('#q-a', 'Acme'); await pg.click('#go'); await pg.wait_for_selector('.cand'); await pg.locator('.cand').nth(1).click(); await pg.click('#go'); await pg.wait_for_selector('.score')
        print('gbp-only summary:', (await pg.inner_text('.summary'))[:70])
        await pg.click('#btn-back')
        # compare live
        await pg.click('#tab-compare'); await pg.fill('#q-a', f'http://127.0.0.1:{site}/'); await pg.fill('#q-b', f'http://127.0.0.1:{site}/good'); await pg.click('#go'); await pg.wait_for_selector('.cmp-head', timeout=15000)
        print('compare:', (await pg.inner_text('.cmp-head')).replace('\n',' ')[:80])
        await pg.click('#btn-back'); await pg.click('#tab-single')
        # bad url
        await pg.fill('#q-a', f'http://127.0.0.1:{site}/nope'); await pg.click('#go'); await pg.wait_for_selector('#err:not([hidden])')
        print('error msg:', await pg.inner_text('#err'))
        print('page errors:', errs)
        await b.close()
try: asyncio.run(main())
finally: proc.terminate()
