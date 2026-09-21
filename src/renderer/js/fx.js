// Фоновые эффекты экрана Focus: частицы и засветы на canvas.
//
// Перенесено из согласованного прототипа (ui-audit/prototypes/tt-prototype.html)
// без изменений в логике рисования. Пресеты читаются с <html>: data-fxp —
// частицы (off / dust / emit / universe / grid), data-fxl — засветы
// (off / bottom / all / aurora). После смены пресета или темы нужно позвать
// FX.refresh(): палитра строится из текущего --accent.
//
// При prefers-reduced-motion движок не запускается вовсе — CSS гасит переходы,
// но requestAnimationFrame ему не подчиняется.

const FX = (() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.getElementById('fx');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, cx = 0, cy = 0, rRing = 150, rMax = 1;
  let raf = null, prev = 0, fade = 0;
  let dust = [], uni = [], emit = [], leaks = [], dots = [], blobs = [];
  const sprites = new Map();

  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ── палитра ─────────────────────────────────────────────────────── */
  function accentHSL() {
    const hex = getComputedStyle(root).getPropertyValue('--accent').trim();
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = h * 60; if (h < 0) h += 360;
    }
    return [h, s, l];
  }
  let HSL = [160, .7, .6];
  const hue = i => (HSL[0] + [0, -26, 26][i] + 360) % 360;
  const col = (i, a, dl = 0) =>
    `hsla(${hue(i)},${Math.round(HSL[1] * 100)}%,${Math.round((HSL[2] + dl) * 100)}%,${a})`;

  /* мягкий кружок рисуется спрайтом — быстрее, чем градиент на каждый кадр */
  function sprite(i) {
    const key = 'c' + i;
    if (sprites.has(key)) return sprites.get(key);
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const sc = s.getContext('2d');
    const g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, col(i, 1, .05));
    g.addColorStop(.45, col(i, .4, .05));
    g.addColorStop(1, col(i, 0, .05));
    sc.fillStyle = g; sc.fillRect(0, 0, 64, 64);
    sprites.set(key, s);
    return s;
  }

  function measure() {
    const b = cv.getBoundingClientRect();
    if (!b.width) return false;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = b.width; H = b.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = document.querySelector('.ring-wrap').getBoundingClientRect();
    cx = r.left - b.left + r.width / 2;
    cy = r.top - b.top + r.height / 2;
    rRing = r.width / 2 - 5;                       // по центру полоски кольца
    rMax = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    return true;
  }

  function spawnEmit(o) {
    o.a = Math.random() * 6.28;
    // эмиттер — широкая полоса ВНУТРЬ и наружу от кольца, «толщиной с палец»:
    // частицы видны и под циферблатом, чёткой границы у круга не возникает
    o.r = rRing + rnd(-52, 24);
    o.r0 = o.r;
    o.sp = rnd(34, 80);
    o.reach = rnd(55, 125);                        // держатся кучно у кольца
    o.sz = rnd(5.6, 12);                           // крупные кружки, как конфетти
    o.ph = rnd(0, 6.28);
    o.c = (Math.random() * 3) | 0;
    return o;
  }

  /* ── построение пресетов ─────────────────────────────────────────── */
  function build() {
    HSL = accentHSL();
    sprites.clear();
    dust = []; uni = []; emit = []; dots = []; blobs = [];
    const p = root.dataset.fxp;

    if (p === 'dust') {
      // равномерно по всему полю, безо всякого центра
      dust = Array.from({ length: 90 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: rnd(-7, 7), vy: rnd(-7, 7),
        sz: rnd(.8, 2.4), ph: rnd(0, 6.28), tw: rnd(.4, 1.3), c: (Math.random() * 3) | 0,
      }));
    }

    if (p === 'universe') {
      // радиус берётся по корню из равномерного по ПЛОЩАДИ: при линейном
      // random центр забивается, а края пустуют. Внутрь кольца не заходим —
      // под циферблатом частицам делать нечего.
      const rIn = rRing * 1.02, rOut = rMax * 1.05;
      uni = Array.from({ length: 300 }, () => {
        const r = Math.sqrt(rnd(rIn * rIn, rOut * rOut));
        return {
          r, a: Math.random() * 6.28,
          w: rnd(.035, .14) * (rRing / r),          // дальние вращаются медленнее
          sz: rnd(.7, 2.3), ph: rnd(0, 6.28), tw: rnd(.5, 1.5), c: (Math.random() * 3) | 0,
        };
      });
    }

    if (p === 'emit') emit = Array.from({ length: 124 }, () => spawnEmit({}));

    if (p === 'grid') {
      const step = 26;
      for (let y = step / 2; y < H; y += step)
        for (let x = step / 2; x < W; x += step) dots.push([x, y]);
      // три разных блоба, чтобы поле не было однородным: крупный, обычный
      // и большой, но еле заметный — лёгкий акцент по краю
      const KIND = [{ rad: 440, k: 1 }, { rad: 190, k: 1 }, { rad: 340, k: .5 }];
      blobs = KIND.map((b, i) => ({
        ph: i * 2.3, sx: rnd(.11, .19), sy: rnd(.09, .17), rad: b.rad, k: b.k,
      }));
    }

    // «Сияние» живёт во втором списке вместе с засветами — так его можно
    // сочетать с любыми частицами, а не выбирать вместо них
    const lm = root.dataset.fxl;
    leaks = (lm === 'off' || lm === 'aurora') ? [] : Array.from({ length: 3 }, (_, i) => ({
      ph: i * 2.1, sp: rnd(.05, .11), rad: rnd(.32, .52), c: i % 3,
    }));
  }

  /* ── отрисовка ───────────────────────────────────────────────────── */
  function drawDust(dt, t) {
    for (const p of dust) {
      p.x += (p.vx + Math.sin(t * .0004 + p.ph) * 6) * dt;
      p.y += (p.vy + Math.cos(t * .0005 + p.ph * 1.4) * 6) * dt;
      if (p.x < -6) p.x = W + 6; if (p.x > W + 6) p.x = -6;
      if (p.y < -6) p.y = H + 6; if (p.y > H + 6) p.y = -6;
      const a = (.22 + .28 * Math.sin(t * .002 * p.tw + p.ph)) * fade;
      ctx.fillStyle = col(p.c, Math.max(a, 0).toFixed(3));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 6.2832); ctx.fill();
    }
  }

  function drawUniverse(dt, t) {
    for (const p of uni) {
      p.a += p.w * dt;
      const x = cx + Math.cos(p.a) * p.r, y = cy + Math.sin(p.a) * p.r;
      const a = (.2 + .3 * Math.sin(t * .002 * p.tw + p.ph)) * fade;
      ctx.fillStyle = col(p.c, Math.max(a, 0).toFixed(3));
      ctx.beginPath(); ctx.arc(x, y, p.sz, 0, 6.2832); ctx.fill();
    }
  }

  function drawEmit(dt, t) {
    // чёткие кружки, без спрайта и без сложения света — конфетти, а не искры
    for (const p of emit) {
      p.r += p.sp * dt;
      // воронка: угловая скорость обратна радиусу, как в водовороте —
      // у кольца закручивает сильно, к краю раскручивается в спираль
      p.a += (58 / Math.max(p.r, 40)) * dt;
      p.a += Math.sin(t * .0006 + p.ph) * .03 * dt;   // турбулентность слабая
      const gone = (p.r - p.r0) / p.reach;
      if (gone >= 1) { spawnEmit(p); continue; }
      const a = Math.sin(gone * Math.PI) * .55 * fade;  // 0 → пик → 0
      if (a <= .004) continue;
      const x = cx + Math.cos(p.a) * p.r, y = cy + Math.sin(p.a) * p.r;
      ctx.fillStyle = col(p.c, a.toFixed(3), .05);
      ctx.beginPath(); ctx.arc(x, y, p.sz, 0, 6.2832); ctx.fill();
    }
  }

  function drawAurora(t) {
    // Горизонтальные ленты, но уведённые в сильный блюр: без него видны
    // грани многоугольника, с ним лента читается как свечение.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(30px)';
    for (let i = 0; i < 3; i++) {
      const k = t * .00016 * (1 + i * .35) + i * 1.9;
      const base = H * (.34 + i * .1);
      const amp = 46 + i * 22, thick = 130 + i * 40;
      ctx.beginPath();
      ctx.moveTo(-60, base);
      for (let x = -60; x <= W + 60; x += 14) {
        const y = base + Math.sin(x * .0042 + k) * amp + Math.sin(x * .0111 + k * 1.7) * amp * .45;
        ctx.lineTo(x, y);
      }
      for (let x = W + 60; x >= -60; x -= 14) {
        const y = base + thick + Math.sin(x * .0042 + k + .6) * amp * 1.15;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - amp, 0, base + thick + amp);
      g.addColorStop(0, col(i, 0));
      g.addColorStop(.45, col(i, (.13 * fade).toFixed(4), .04));
      g.addColorStop(1, col(i, 0));
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGrid(t) {
    // точки видны только в поле притяжения блоба: ближе к центру — крупнее
    const bs = blobs.map(b => [
      W * (.5 + .4 * Math.sin(t * .001 * b.sx + b.ph)),
      H * (.5 + .4 * Math.cos(t * .001 * b.sy + b.ph * 1.3)),
      b.rad, b.k,
    ]);
    for (const [x, y] of dots) {
      // яркость блоба применяется ТОЛЬКО к прозрачности: если гасить ею и
      // геометрию, тусклый блоб после возведения в квадрат исчезает совсем
      let inf = 0, k = 1;
      for (const b of bs) {
        const d = Math.hypot(x - b[0], y - b[1]);
        if (d >= b[2]) continue;
        const v = 1 - d / b[2];
        if (v > inf) { inf = v; k = b[3]; }
      }
      if (inf <= .02) continue;
      const e = inf * inf;
      ctx.fillStyle = col(0, (e * k * .8 * fade).toFixed(3));
      ctx.beginPath(); ctx.arc(x, y, .5 + e * 2.6, 0, 6.2832); ctx.fill();
    }
  }

  function drawLeaks(t) {
    if (root.dataset.fxl === 'aurora') { drawAurora(t); return; }
    if (!leaks.length) return;
    const bottom = root.dataset.fxl === 'bottom';
    ctx.globalCompositeOperation = 'lighter';
    for (const l of leaks) {
      const k = t * .001 * l.sp;
      const x = W * (.5 + .42 * Math.sin(k + l.ph));
      const y = bottom ? H * (.92 + .06 * Math.sin(k * 1.6 + l.ph))
                       : H * (.5 + .44 * Math.cos(k * .8 + l.ph * 1.7));
      const rad = Math.min(W, H) * l.rad;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, col(l.c, (.11 * fade).toFixed(4)));
      g.addColorStop(.3, col(l.c, (.075 * fade).toFixed(4)));
      g.addColorStop(.55, col(l.c, (.04 * fade).toFixed(4)));
      g.addColorStop(.8, col(l.c, (.015 * fade).toFixed(4)));
      g.addColorStop(1, col(l.c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  const DRAW = { dust: drawDust, universe: drawUniverse, emit: drawEmit };

  function frame(t) {
    const dt = Math.min((t - prev) / 1000, .05);
    prev = t;
    fade = Math.min(1, fade + dt / .7);            // общий плавный ввод
    ctx.clearRect(0, 0, W, H);
    drawLeaks(t);
    const p = root.dataset.fxp;
    if (p === 'grid') drawGrid(t);
    else if (DRAW[p]) DRAW[p](dt, t);
    raf = requestAnimationFrame(frame);
  }

  // init() зовёт applyFx() раньше, чем showMainScreen(): канва в этот момент
  // ещё скрыта, и measure() возвращает false. Раньше refresh() на этом молча
  // выходил, и движок не заводился до первого переключения вида. Теперь ждём,
  // пока канва получит размер, и запускаемся сами.
  let waitingForSize = null;

  function retryWhenSized() {
    if (waitingForSize) return;
    waitingForSize = new ResizeObserver(() => {
      if (!cv.getBoundingClientRect().width) return;
      stopWaiting();
      refresh();
    });
    waitingForSize.observe(cv);
  }

  function stopWaiting() {
    if (!waitingForSize) return;
    waitingForSize.disconnect();
    waitingForSize = null;
  }

  function refresh() {
    const live = !reduced && root.dataset.mode === 'focus'
      && (root.dataset.fxp !== 'off' || root.dataset.fxl !== 'off');
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    ctx.clearRect(0, 0, W, H);
    if (!live) { stopWaiting(); return; }
    if (!measure()) { retryWhenSized(); return; }
    stopWaiting();
    build();
    fade = 0;
    prev = performance.now();
    raf = requestAnimationFrame(frame);
  }

  addEventListener('resize', () => { if (raf) { measure(); build(); } });
  return { refresh };
})();

// const в глобальном скрипте не попадает в window — экспортируем явно,
// чтобы app.js мог звать движок через необязательную цепочку.
window.FX = FX;
