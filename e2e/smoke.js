// Smoke test of the real app: Electron starts on a throwaway profile, the
// onboarding is passed, Focus and all five Dashboard views open, and the page
// reports no errors on the way. Plus the one promise the idle effects make that
// only a live window can check: under prefers-reduced-motion they never start.
//
// Kept out of `npm test` on purpose - it needs the Electron binary and a display,
// while the unit tests need neither. Run with `npm run smoke`.
//
// Playwright's Electron support is still marked experimental
// (microsoft/playwright#39477); the calls used here are the basic ones -
// launch, firstWindow, evaluate, click.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { _electron } = require('playwright-core')

const ROOT = path.join(__dirname, '..')
const VIEWS = ['summary', 'calendar', 'settings', 'appearance', 'about']

// Electron reads its switches only before the app path.
async function launch() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-smoke-'))
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [`--user-data-dir=${profile}`, ROOT],
    cwd: ROOT,
  })
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  await page.waitForLoadState('load')
  const close = async () => {
    await app.close()
    fs.rmSync(profile, { recursive: true, force: true })
  }
  return { app, page, errors, close }
}

// setMode ignores clicks while a transition runs (modeBusy), and data-mode flips
// at its start, not its end - so waiting for the attribute alone is not enough.
function modeSettled(page, mode) {
  return page.waitForFunction(mode =>
    document.documentElement.dataset.mode === mode &&
    !document.getElementById('app').classList.contains('anim'), mode)
}

async function passOnboarding(page) {
  await page.waitForSelector('#onboarding-name-input', { state: 'visible' })
  await page.fill('#onboarding-name-input', 'Smoke')
  await page.click('#onboarding-continue')
  await page.waitForSelector('#main-screen:not(.hidden)')
}

// The first idle effect plays right after the window loads (idle-fx.js, start()),
// so a few seconds of sampling are enough to see it - or to see that it never
// came. Any drawn frame leaves a path on the arc or a width on the segment.
function sampleIdle(page, ms = 4000) {
  return page.evaluate(ms => new Promise(resolve => {
    const seen = new Set()
    const arc = document.getElementById('idle-arc')
    const seg = document.getElementById('idle-seg')
    const started = performance.now()
    ;(function probe() {
      if (arc.getAttribute('d')) seen.add('ring')
      if (seg.style.width && seg.style.width !== '0%') seen.add('bar')
      if (performance.now() - started < ms) requestAnimationFrame(probe)
      else resolve([...seen])
    })()
  }), ms)
}

test('starts, passes onboarding and opens Focus and all five views without errors', { timeout: 90_000 }, async () => {
  const { page, errors, close } = await launch()
  try {
    await passOnboarding(page)
    assert.equal(await page.evaluate(() => document.documentElement.dataset.mode), 'focus')

    await page.click('#tbtn')
    await modeSettled(page, 'dash')
    for (const view of VIEWS) {
      await page.click(`[data-nav="${view}"]`)
      const open = await page.evaluate(() => document.querySelector('.view.on')?.dataset.view)
      assert.equal(open, view)
    }

    await page.click('#tbtn')
    await modeSettled(page, 'focus')
    assert.deepEqual(errors, [])
  } finally {
    await close()
  }
})

test('idle effects play in Focus by default, and never start under reduced motion', { timeout: 90_000 }, async () => {
  // Positive control first: without it an empty sample would prove nothing -
  // the probe itself could be blind.
  const normal = await launch()
  try {
    await passOnboarding(normal.page)
    assert.notDeepEqual(await sampleIdle(normal.page), [], 'no idle frame was drawn at all')
  } finally {
    await normal.close()
  }

  // Chromium's --force-prefers-reduced-motion switch is not honoured by Electron,
  // so the media feature is emulated over CDP. idle-fx.js reads it once, when the
  // module is evaluated, hence the reload: emulation survives it, and the module
  // runs again under it.
  const reduced = await launch()
  try {
    await reduced.page.emulateMedia({ reducedMotion: 'reduce' })
    await reduced.page.reload()
    await passOnboarding(reduced.page)
    assert.equal(await reduced.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true)
    assert.deepEqual(await sampleIdle(reduced.page), [])
    assert.deepEqual(reduced.errors, [])
  } finally {
    await reduced.close()
  }
})
