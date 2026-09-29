// Статичная картинка для превью фона в Оформлении. Превью не запускает движок:
// оно показывает заранее сгенерированный кадр каждого пресета, а цвет берёт из
// темы через CSS. Кадр строится по тем же правилам, что src/renderer/js/fx.js
// (количество, размеры, прозрачности, формулы засветов и Aurora) — поменяли
// движок, перезапустите скрипт:
//
//   node scripts/fx-preview-art.cjs
//
// Он заменяет блок между метками fx-preview-art в src/renderer/index.html.
//
// Сцена — окно Focus 1280×812 с кольцом радиуса 150 в центре; превью
// показывает из неё полосу через центр (viewBox ниже). Частицы в превью
// нарисованы крупнее, чем в сцене: полоса ужата примерно в 2.4 раза, и в
// натуральную величину пыль и звёзды стали бы меньше пикселя.

const fs = require('fs')
const path = require('path')

const W = 1280, H = 812, cx = W / 2, cy = H / 2, rRing = 150
const BAND = { y: 292, h: 228 }
const ENLARGE = 2.2
const rMax = Math.hypot(cx, cy)

// Детерминированный генератор: картинка не меняется от запуска к запуску,
// и дифф после перегенерации показывает только настоящие изменения.
let seed = 20260929
const random = () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}
const rnd = (a, b) => a + random() * (b - a)
const pick3 = () => (random() * 3) | 0
const n = v => Math.round(v * 10) / 10
const a3 = v => Math.max(0, Math.round(v * 1000) / 1000)
const inBand = (y, pad) => y > BAND.y - pad && y < BAND.y + BAND.h + pad

const dot = (x, y, r, c, a) => a > 0.004 && inBand(y, r)
  ? `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" class="c${c}" fill-opacity="${a3(a)}"/>` : ''

function dust() {
  return Array.from({ length: 90 }, () => {
    const x = random() * W, y = random() * H, sz = rnd(.8, 2.4), ph = rnd(0, 6.28)
    return dot(x, y, sz * ENLARGE, pick3(), .22 + .28 * Math.sin(ph))
  }).join('')
}

function universe() {
  const rIn = rRing * 1.02, rOut = rMax * 1.05
  return Array.from({ length: 300 }, () => {
    const r = Math.sqrt(rnd(rIn * rIn, rOut * rOut)), a = random() * 6.28
    const sz = rnd(.7, 2.3), ph = rnd(0, 6.28)
    return dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, sz * ENLARGE, pick3(), .2 + .3 * Math.sin(ph))
  }).join('')
}

function emit() {
  // кадр из середины жизни частиц: у каждой свой пройденный путь
  return Array.from({ length: 124 }, () => {
    const a = random() * 6.28, r0 = rRing + rnd(-52, 24), reach = rnd(55, 125)
    const sz = rnd(5.6, 12), gone = random()
    const r = r0 + gone * reach
    return dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, sz, pick3(), Math.sin(gone * Math.PI) * .55)
  }).join('')
}

function grid() {
  // положение сгустков — формула движка в момент, когда все три видны в полосе
  const t = 9000
  const KIND = [{ rad: 440, k: 1 }, { rad: 190, k: 1 }, { rad: 340, k: .5 }]
  const bs = KIND.map((b, i) => {
    const sx = [.15, .13, .17][i], sy = [.12, .15, .1][i], ph = i * 2.3
    return [W * (.5 + .4 * Math.sin(t * .001 * sx + ph)), H * (.5 + .4 * Math.cos(t * .001 * sy + ph * 1.3)), b.rad, b.k]
  })
  let out = ''
  const step = 26
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      let inf = 0, k = 1
      for (const b of bs) {
        const d = Math.hypot(x - b[0], y - b[1])
        if (d >= b[2]) continue
        const v = 1 - d / b[2]
        if (v > inf) { inf = v; k = b[3] }
      }
      if (inf <= .02) continue
      const e = inf * inf
      out += dot(x, y, (.5 + e * 2.6) * ENLARGE * .7, 0, e * k * .8)
    }
  }
  return out
}

// Засветы: три радиальных пятна с теми же пятью ступенями прозрачности, что в
// движке. t выбран так, чтобы пятна «Везде» попадали в полосу превью.
function leaks(bottom, ids) {
  const t = bottom ? 4000 : 26000
  let defs = '', body = ''
  for (let i = 0; i < 3; i++) {
    const ph = i * 2.1, sp = [.08, .06, .1][i], radK = [.46, .38, .5][i], c = i % 3
    const k = t * .001 * sp
    const x = W * (.5 + .42 * Math.sin(k + ph))
    const y = bottom ? H * (.92 + .06 * Math.sin(k * 1.6 + ph)) : H * (.5 + .44 * Math.cos(k * .8 + ph * 1.7))
    const rad = Math.min(W, H) * radK
    const id = `${ids}-${i}`
    defs += `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(x)}" cy="${n(y)}" r="${n(rad)}">` +
      [[0, .11], [.3, .075], [.55, .04], [.8, .015], [1, 0]]
        .map(([o, a]) => `<stop offset="${o}" class="s${c}" stop-opacity="${a}"/>`).join('') + '</radialGradient>'
    body += `<rect x="${n(x - rad)}" y="${n(y - rad)}" width="${n(rad * 2)}" height="${n(rad * 2)}" fill="url(#${id})" class="add"/>`
  }
  return { defs, body }
}

function aurora() {
  const t = 12000
  let defs = '<filter id="fxa-blur" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="30"/></filter>'
  let body = ''
  for (let i = 0; i < 3; i++) {
    const k = t * .00016 * (1 + i * .35) + i * 1.9
    const base = H * (.34 + i * .1), amp = 46 + i * 22, thick = 130 + i * 40
    const pts = []
    for (let x = -60; x <= W + 60; x += 28) pts.push([x, base + Math.sin(x * .0042 + k) * amp + Math.sin(x * .0111 + k * 1.7) * amp * .45])
    for (let x = W + 60; x >= -60; x -= 28) pts.push([x, base + thick + Math.sin(x * .0042 + k + .6) * amp * 1.15])
    const id = `fxa-g${i}`
    defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${n(base - amp)}" x2="0" y2="${n(base + thick + amp)}">` +
      `<stop offset="0" class="s${i}" stop-opacity="0"/><stop offset=".45" class="s${i}" stop-opacity=".13"/><stop offset="1" class="s${i}" stop-opacity="0"/></linearGradient>`
    body += `<path d="M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z" fill="url(#${id})" class="add" filter="url(#fxa-blur)"/>`
  }
  return { defs, body }
}

const bottom = leaks(true, 'fxl-b'), all = leaks(false, 'fxl-a'), au = aurora()
const svg = [
  `<svg class="fxprev-art" viewBox="0 ${BAND.y} ${W} ${BAND.h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`,
  `<defs>${bottom.defs}${all.defs}${au.defs}</defs>`,
  `<g data-fxl="bottom">${bottom.body}</g>`,
  `<g data-fxl="all">${all.body}</g>`,
  `<g data-fxl="aurora">${au.body}</g>`,
  `<g data-fxp="dust">${dust()}</g>`,
  `<g data-fxp="emit">${emit()}</g>`,
  `<g data-fxp="universe">${universe()}</g>`,
  `<g data-fxp="grid">${grid()}</g>`,
  '</svg>',
].join('\n                    ')

const file = path.join(__dirname, '..', 'src', 'renderer', 'index.html')
const html = fs.readFileSync(file, 'utf8')
const START = '<!-- fx-preview-art:start - generated by scripts/fx-preview-art.cjs, do not edit by hand -->'
const END = '<!-- fx-preview-art:end -->'
const a = html.indexOf(START), b = html.indexOf(END)
if (a < 0 || b < 0) throw new Error('fx-preview-art markers not found in index.html')
fs.writeFileSync(file, html.slice(0, a + START.length) + '\n                    ' + svg + '\n                    ' + html.slice(b))
console.log(`index.html: fx preview art written, ${svg.length} bytes`)
