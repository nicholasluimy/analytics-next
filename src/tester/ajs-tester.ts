/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { Analytics } from '..'
import { SerializedContext } from '../core/context'
import mem from 'micro-memoize'
import playwright from 'playwright'

type BrowserType = 'chromium' | 'firefox' | 'webkit'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStub(page: playwright.Page) {
  const stub = {
    async register(...args: Parameters<Analytics['register']>): Promise<void> {
      return await page.evaluate((innerArgs) => {
        // @ts-ignore
        return window.analytics.register(...innerArgs)
        // @ts-ignore
      }, args)
    },
    async track(...args: Parameters<Analytics['track']>): Promise<SerializedContext> {
      const ctx = await page.evaluate((innerArgs) => {
        // @ts-ignore
        return window.analytics.track(...innerArgs).then((ctx) => {
          return ctx.toJSON()
        })
        // @ts-ignore
      }, args)

      return ctx as SerializedContext
    },
    async page(...args: Parameters<Analytics['page']>): Promise<SerializedContext> {
      const ctx = await page.evaluate(async (innerArgs) => {
        // @ts-ignore
        return window.analytics.page(...innerArgs).then((ctx) => {
          return ctx.toJSON()
        })
        // @ts-ignore
      }, args)

      return ctx as SerializedContext
    },

    async identify(...args: Parameters<Analytics['identify']>): Promise<SerializedContext> {
      const ctx = await page.evaluate((innerArgs) => {
        // @ts-ignore
        return window.analytics.identify(...innerArgs).then((ctx) => {
          return ctx.toJSON()
        })
        // @ts-ignore
      }, args)

      return ctx as SerializedContext
    },

    browserPage: page,
  }

  return stub
}

const getBrowser = mem(async (browserType?: BrowserType, remoteDebug?: boolean) => {
  const browser = await playwright[browserType ?? 'chromium'].launch({
    headless: true,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', remoteDebug ? '--remote-debugging-port=9222' : ''],
  })

  process.on('unhandledRejection', () => {
    browser && browser.close()
  })

  return browser
})

export async function testerTeardown() {
  const browser = await getBrowser()
  await browser.close()
}

export async function tester(
  _writeKey: string,
  url?: string,
  browserType?: BrowserType,
  remoteDebug?: boolean
): Promise<ReturnType<typeof makeStub>> {
  const browser = await getBrowser(browserType, remoteDebug)
  const page = await browser.newPage()

  await page.goto(url || `file://${process.cwd()}/src/tester/__fixtures__/index.html`)
  await page.evaluate(`
    window.AnalyticsNext.Analytics.load({
      writeKey: '${_writeKey}',
    }).then(loaded => {
      window.analytics = loaded[0]
    })
  `)

  await page.waitForFunction('window.analytics !== undefined')
  return makeStub(page)
}
