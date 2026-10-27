const { chromium } = require('C:/Users/zhmou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs/promises')

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const errors = []
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
    page.on('requestfailed', request => console.error(request.url(), request.failure()?.errorText))
    const base = 'http://localhost:5174/path-seeker/client'
    const modules = await Promise.all([
      fetch(`${base}/src/components/translation/TranslationRoomExperience.vue`).then(response => response.text()),
      fetch(`${base}/src/composables/useTranslationRoom.ts`).then(response => response.text()),
    ])
    let html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf8')
    for (const name of ['vue', 'pinia', 'vue-router']) {
      const dependency = modules.join('\n').match(new RegExp(`from "([^"]+/deps/${name}\\.js[^\"]*)"`))?.[1]
      assert.ok(dependency, `Missing Vite dependency: ${name}`)
      html = html.replace(`from '${name}'`, `from '${dependency}'`)
    }
    await page.route('**/outputs/h5-room-review/index.html', route => route.fulfill({ contentType: 'text/html', body: html }))
    await page.goto('http://localhost:5174/path-seeker/client/@fs/D:/workspace/amh/code/CulturalTourism/web/path-seeker-ui/outputs/h5-room-review/index.html')
    await page.waitForFunction(() => window.reviewReady)
    const checkBounds = async () => {
      const bounds = await page.evaluate(() => {
        const room = document.querySelector('.translation-room').getBoundingClientRect()
        const toolbar = document.querySelector('.chat-toolbar').getBoundingClientRect()
        const scroll = document.querySelector('.chat-scroll')
        return { top: room.top, bottom: room.bottom, toolbarBottom: toolbar.bottom, height: window.visualViewport.height, width: room.width, scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth }
      })
      assert.equal(bounds.top, 0)
      assert.ok(Math.abs(bounds.bottom - bounds.height) < 1)
      assert.ok(Math.abs(bounds.toolbarBottom - bounds.height) < 1)
      assert.equal(bounds.scrollWidth, bounds.clientWidth)
      return bounds
    }
    const initial = await checkBounds()
    await page.screenshot({ path: path.join(__dirname, 'room-empty.png') })
    await page.evaluate(() => window.review.feed())
    await page.locator('.chat-bilingual').first().waitFor()
    assert.equal(await page.locator('.chat-bilingual').count(), 2)
    assert.equal(await page.locator('.chat-avatar-translation').count(), 0)
    const order = await page.locator('.chat-bilingual').first().evaluate(element => {
      const translation = element.querySelector('.chat-translation').getBoundingClientRect()
      const source = element.querySelector('.chat-source').getBoundingClientRect()
      return translation.bottom <= source.top
    })
    assert.equal(order, true)
    await page.screenshot({ path: path.join(__dirname, 'room-guest.png') })
    await page.setViewportSize({ width: 393, height: 610 })
    await page.waitForTimeout(100)
    const resized = await checkBounds()
    await page.evaluate(() => window.review.feed(true))
    await page.locator('.chat-translation').nth(2).waitFor()
    assert.equal(await page.locator('.chat-bilingual').first().locator('.chat-source').count(), 1)
    assert.equal(await page.locator('.chat-bilingual').first().locator('.chat-translation').count(), 2)
    await page.screenshot({ path: path.join(__dirname, 'room-host.png') })
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ initial, resized, translationAboveOriginal: order, pageErrors: errors }))
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
