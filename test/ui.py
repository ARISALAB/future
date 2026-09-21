import asyncio, json, subprocess
from playwright.async_api import async_playwright
FILE='file:///home/claude/checkup/dist/checkup.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(FILE); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/home/claude/checkup/test/s-input.png')
        # sample single
        await pg.click('#sample'); await pg.wait_for_timeout(300)
        print('score:', await pg.inner_text('.score'), '| neg badges:', await pg.inner_text('.col.neg h2'))
        print('story paras:', await pg.locator('#story p').count(), '| editable:', await pg.get_attribute('#story','contenteditable'), '| conseq lines:', await pg.locator('text=Τι κινδυνεύεις').count())
        await pg.fill('#adv-by','AR Akron Services'); await pg.fill('#adv-note','Προτείνω να ξεκινήσουμε από τον τίτλο.'); print('print block:', (await pg.inner_text('#adv-print', timeout=2000)) if False else await pg.evaluate("document.getElementById('adv-print').textContent"))
        print('bench cards:', await pg.locator('#bench .b3 .card').count(), '| sample tag:', await pg.locator('#bench .sample-tag').count())
        await pg.screenshot(path='/home/claude/checkup/test/s-report.png', full_page=True)
        # dark
        await pg.click('#btn-theme'); await pg.wait_for_timeout(100)
        await pg.screenshot(path='/home/claude/checkup/test/s-report-dark.png', full_page=True)
        await pg.click('#btn-theme')
        # back + compare sample
        await pg.click('#btn-back'); await pg.click('#tab-compare'); await pg.click('#sample'); await pg.wait_for_timeout(300)
        print('cmp summary:', (await pg.inner_text('.summary')).strip()[:120])
        await pg.screenshot(path='/home/claude/checkup/test/s-compare.png', full_page=True)
        # paste flow
        await pg.click('#btn-back'); await pg.click('#tab-single')
        await pg.click('details.paste summary'); await pg.fill('#h-a','<html><head><title>Δοκιμή</title></head><body><h1>Γεια</h1></body></html>')
        await pg.click('#go'); await pg.wait_for_timeout(300)
        print('paste score:', await pg.inner_text('.score'))
        # copy fix button exists?
        # error paths
        await pg.click('#btn-back'); await pg.fill('#h-a','απλό κείμενο'); await pg.click('#go'); await pg.wait_for_timeout(200)
        print('err:', await pg.inner_text('#err'))
        await pg.fill('#h-a',''); await pg.fill('#q-a','foo.gr'); await pg.click('#go'); await pg.wait_for_timeout(200)
        print('err2:', await pg.inner_text('#err'))
        print('page errors:', errs)
        # mobile
        m=await b.new_page(viewport={'width':390,'height':844}, device_scale_factor=2)
        await m.goto(FILE); await m.click('#sample'); await m.wait_for_timeout(300)
        print('mobile scrollWidth', await m.evaluate('document.documentElement.scrollWidth'))
        await m.screenshot(path='/home/claude/checkup/test/s-mobile.png', full_page=False)
        await b.close()
asyncio.run(main())
