import asyncio, subprocess, sys, json
from playwright.async_api import async_playwright
proc = subprocess.Popen(['node','test/e2e-server.js'], stdout=subprocess.PIPE, text=True, cwd='/home/claude/checkup')
line = proc.stdout.readline().strip(); _, app, site = line.split()
MOCK = {"lighthouseResult":{"categories":{"performance":{"score":0.62},"accessibility":{"score":0.9},"seo":{"score":1},"best-practices":{"score":0.8}},"audits":{"largest-contentful-paint":{"displayValue":"3,4 s","score":0.4},"first-contentful-paint":{"displayValue":"1,2 s","score":0.9},"uses-optimized-images":{"title":"Συμπίεση εικόνων","displayValue":"1 s","details":{"type":"opportunity","overallSavingsMs":1000}}}}}
state = {'mode':'ok'}
async def psi(route):
    if state['mode']=='429':
        await route.fulfill(status=429, headers={'access-control-allow-origin':'*','content-type':'application/json'}, body='{"error":{"code":429}}')
    else:
        await route.fulfill(status=200, headers={'access-control-allow-origin':'*','content-type':'application/json'}, body=json.dumps(MOCK))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1280,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/pagespeedonline/**', psi)
        await pg.goto(f'http://127.0.0.1:{app}/'); await pg.wait_for_timeout(600)
        print('url input visible:', await pg.is_visible('#q-a'), '| note visible:', await pg.locator('.note').count())
        # URL analysis
        await pg.fill('#q-a', f'http://127.0.0.1:{site}/'); await pg.click('#go'); await pg.wait_for_selector('.score', timeout=15000)
        print('live score:', (await pg.inner_text('.score')).replace('\n',''), '| pages rows:', await pg.locator('.tbl tbody tr').count())
        await pg.wait_for_selector('.speed .big', timeout=8000)
        print('speed:', await pg.inner_text('.speed .big'), '| opp:', await pg.locator('.speed .wins li').count(), '| copy cat:', await pg.locator('text=Ποιότητα κειμένου').count())
        await pg.screenshot(path='test/e2e-speed.png', full_page=True)
        await pg.wait_for_selector('#bench .b3 .card >> nth=2', timeout=20000)
        print('AUTO bench cards:', await pg.locator('#bench .b3 .card').count(), '| provider text:', (await pg.inner_text('#bench .hint'))[:60], '| query:', await pg.input_value('#b-q'), '| next btn:', await pg.locator('#b-next').count())
        await pg.screenshot(path='test/e2e-auto.png', full_page=True)
        await pg.fill('#b-u0', f'http://127.0.0.1:{site}/good'); await pg.fill('#b-u1', f'http://127.0.0.1:{site}/'); await pg.click('#b-run')
        await pg.wait_for_selector('#bench .b3 .card >> nth=2', timeout=15000)
        print('bench cards live:', await pg.locator('#bench .b3 .card').count(), '| gaps badge:', (await pg.inner_text('#bench .col.neg h2')).replace('\n',' '))
        await pg.screenshot(path='test/e2e-bench.png', full_page=True)
        state['mode']='429'
        await pg.click('#btn-back'); await pg.fill('#q-a', f'http://127.0.0.1:{site}/'); await pg.click('#go'); await pg.wait_for_selector('.speed .note', timeout=8000)
        print('429 msg:', (await pg.inner_text('.speed .note'))[:70]); state['mode']='ok'
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
