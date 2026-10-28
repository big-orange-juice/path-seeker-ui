const { chromium } = require('C:/Users/zhmou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const base = 'http://127.0.0.1:5177/path-seeker/client'
const authKey = 'path-seeker:h5-client:auth'
const tour = { id: '900000000000000003', title: '登录保留测试路线', locale: 'zh', stopCount: 1 }
const history = { routeId: tour.id, routeTitle: tour.title, status: 2, solvedCount: 1, puzzleCount: 1 }
const host = { userId: '900000000000000002', nickname: '测试车夫', isGuest: false, accessToken: 'host-fixture', refreshToken: 'host-refresh', expiresIn: 3600 }

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const result = { mockedBackend: true, cases: [], pageErrors: [] }
  try {
    for (const entry of ['/shell/me', '/shell/archive']) {
      for (const condition of ['valid', 'reload', 'refresh', 'offline', 'rejected', 'missing-refresh']) {
        const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
        try {
          const page = await context.newPage()
          let guestRequests = 0
          let refreshRequests = 0
          const allowRefresh = condition === 'refresh'
          const catalogTokens = []
          page.on('pageerror', error => result.pageErrors.push(error.message))
          await page.route('**/*', async route => {
            const url = new URL(route.request().url())
            if (!/\/api\//.test(url.pathname)) return url.hostname === '127.0.0.1' ? route.continue() : route.abort()
            let data = {}
            if (url.pathname.endsWith('/GuestLogin')) {
              guestRequests++
              data = { userId: '900000000000000001', nickname: '游客', isGuest: true, accessToken: 'guest-fixture', expiresIn: 3600 }
            }
            if (url.pathname.endsWith('/Login')) data = host
            if (url.pathname.endsWith('/RefreshToken')) {
              refreshRequests++
              if (allowRefresh) data = { ...host, accessToken: 'refreshed-host-fixture' }
              else if (condition === 'offline') return route.abort('failed')
              else return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 10002, message: '续期已失效' }) })
            }
            if (url.pathname.endsWith('/MyCompletedRoutes')) data = [history]
            if (url.pathname.endsWith('/MyFootprints')) data = { list: [history] }
            if (url.pathname.endsWith('/MyRouteHistory')) data = { list: [{ ...history, status: 1 }] }
            if (url.pathname.endsWith('/ClientCatalog/Catalog')) {
              catalogTokens.push(route.request().headers().authorization)
              data = { routes: [tour], destinations: [], places: [] }
            }
            if (url.pathname.endsWith('/ClientCatalog/Route')) data = { route: tour, stops: [] }
            if (url.pathname.endsWith('/RouteVisit/Active')) data = null
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data }) })
          })
          await page.goto(base + entry)
          await page.locator('header .client-user-pill').click()
          await page.getByPlaceholder('用户名 / 手机号 / 邮箱').fill('fixture-account')
          await page.getByPlaceholder('密码', { exact: true }).fill('fixture-password')
          await page.locator('button[type="submit"]').click()
          await page.waitForURL(base + entry)
          await page.locator('.history-card').first().waitFor()
          const originalGuestRequests = guestRequests
          if (condition === 'reload') {
            await page.reload()
            await page.locator('.history-card').first().waitFor()
          }
          if (!['valid', 'reload'].includes(condition)) {
            await page.evaluate(missingRefresh => {
              const auth = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('auth')
              auth.expiresAt = 1
              if (missingRefresh) auth.refreshToken = ''
              auth.$persist()
              localStorage.setItem('path-seeker:tour-locale', 'zh')
            }, condition === 'missing-refresh')
          } else await page.evaluate(() => localStorage.setItem('path-seeker:tour-locale', 'zh'))
          await page.locator('.history-card').first().click()
          if (['valid', 'reload', 'refresh'].includes(condition)) {
            await page.waitForURL(base + '/ride?routeId=' + tour.id)
            await page.waitForFunction(() => document.querySelector('.tour-account')?.textContent === '账号')
            assert.equal(await page.locator('.tour-account').getAttribute('aria-label'), '管理当前账号')
          } else {
            await page.waitForURL(url => url.pathname.endsWith('/auth'))
            assert.equal(new URL(page.url()).searchParams.get('redirect'), '/ride?routeId=' + tour.id)
            await page.getByPlaceholder('用户名 / 手机号 / 邮箱').waitFor()
            assert.equal(await page.locator('.auth-session').count(), 0)
            const state = await page.evaluate(authKey => {
              const stored = JSON.parse(localStorage.getItem(authKey))
              return { preserved: stored.accessToken === 'host-fixture', hasRefresh: stored.refreshToken === 'host-refresh' }
            }, authKey)
            assert.equal(state.preserved, condition !== 'rejected')
            if (condition === 'offline') assert.equal(state.hasRefresh, true)
            await page.getByPlaceholder('用户名 / 手机号 / 邮箱').fill('fixture-account')
            await page.getByPlaceholder('密码', { exact: true }).fill('fixture-password')
            await page.locator('button[type="submit"]').click()
            await page.waitForURL(base + '/ride?routeId=' + tour.id)
            await page.waitForFunction(() => document.querySelector('.tour-account')?.textContent === '账号')
          }
          assert.equal(guestRequests, originalGuestRequests)
          assert.equal(refreshRequests, ['refresh', 'offline', 'rejected'].includes(condition) ? 1 : 0)
          assert.ok(catalogTokens.length > 0)
          assert.ok(catalogTokens.every(token => token === 'Bearer host-fixture' || token === 'Bearer refreshed-host-fixture'))
          await page.reload()
          await page.waitForFunction(() => document.querySelector('.tour-account')?.textContent === '账号')
          assert.equal(guestRequests, originalGuestRequests)
          result.cases.push({ entry, condition, noGuestReplacement: true, mapKeepsAccount: true, reloadKeepsAccount: true })
        } finally { await context.close() }
      }
    }
    assert.deepEqual(result.pageErrors, [])
    fs.writeFileSync(path.join(__dirname, 'history-session-result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
