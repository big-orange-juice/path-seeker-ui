const { chromium } = require('C:/Users/zhmou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const result = { mockedBackend: true, cases: [], pageErrors: [] }
  try {
    for (const entry of [
      { path: '/shell/archive?tab=completed', selector: 'header .client-user-pill' },
      { path: '/shell/me', selector: 'button:has-text("绑定账号")' },
      { path: '/translation-room', selector: '.room-header a:has-text("登录车夫账号")' },
    ]) {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
      const page = await context.newPage()
      let loggedIn = false
      const accountPageFlashes = []
      page.on('pageerror', error => result.pageErrors.push(error.message))
      await page.exposeFunction('accountPageFlash', () => accountPageFlashes.push(true))
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          new MutationObserver(() => {
            if (document.querySelector('.auth-session')) window.accountPageFlash()
          }).observe(document.body, { childList: true, subtree: true })
        })
      })
      await page.route('**/*', async route => {
        const url = new URL(route.request().url())
        if (!/\/api\//.test(url.pathname)) return url.hostname === '127.0.0.1' ? route.continue() : route.abort()
        let data = { items: [], total: 0 }
        if (/AppUser\/GuestLogin$/.test(url.pathname)) data = { userId: '900000000000000001', nickname: '测试游客', isGuest: true, accessToken: 'guest-fixture', expiresIn: 3600 }
        if (/AppUser\/Login$/.test(url.pathname)) {
          loggedIn = true
          data = { userId: '900000000000000002', nickname: '测试车夫', isGuest: false, accessToken: 'account-fixture', expiresIn: 3600 }
        }
        if (/ClientCatalog\/Catalog$/.test(url.pathname)) data = { routes: [], destinations: [], places: [] }
        if (/host-permission$/.test(url.pathname)) data = { canHost: loggedIn }
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 0, data }) })
      })
      await page.goto('http://127.0.0.1:5177/path-seeker/client' + entry.path)
      await page.locator(entry.selector).click()
      await page.locator('.auth-panel').waitFor()
      assert.equal(new URL(page.url()).searchParams.get('redirect'), entry.path)
      await page.locator('.auth-back').click()
      await page.waitForURL(url => url.pathname + url.search === '/path-seeker/client' + entry.path)
      await page.locator(entry.selector).click()
      await page.getByPlaceholder('用户名 / 手机号 / 邮箱').fill('fixture-account')
      await page.getByPlaceholder('密码', { exact: true }).fill('fixture-password')
      await page.locator('button[type="submit"]').click()
      await page.waitForURL(url => url.pathname + url.search === '/path-seeker/client' + entry.path)
      await page.waitForTimeout(800)
      assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, '/path-seeker/client' + entry.path)
      assert.equal(accountPageFlashes.length, 0)
      if (entry.path === '/translation-room') assert.match(await page.locator('.room-form').innerText(), /车夫讲解台/)
      else {
        await page.goBack()
        await page.waitForTimeout(300)
        assert.ok(!new URL(page.url()).pathname.endsWith('/auth'))
      }
      result.cases.push({ entry: entry.path, preservesReturnPath: true, explicitBackWorks: true, loginReturnsToEntry: true, accountPageFlashes: 0, stableAfterLogin: true })
      await context.close()
    }
    assert.deepEqual(result.pageErrors, [])
    fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
