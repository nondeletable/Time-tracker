// Idle-анимации экрана Focus: раз в полторы-две минуты по кольцу дневной цели
// или по нижней полосе периода пробегает короткий эффект и уходит. Пустые
// кольцо и полоса при неидущем таймере выглядят мёртво — это лечится движением.
//
// Набор пресетов, формула интервала и правила выбраны владельцем на стендах
// ui-audit/prototypes/tt-idle-fx*.html. Разбор — docs/superpowers/specs/2026-09-22-idle-fx-design.md.
//
// Эффект играет и поверх реальной заливки при идущем таймере: на пересечении с
// заполненным участком цвет разводится, иначе акцент поверх акцента даёт акцент
// и движения не видно. При prefers-reduced-motion движок не запускается вовсе,
// как и fx.js: CSS гасит переходы, но requestAnimationFrame ему не подчиняется.

export const IDLE_FX = (() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  const arcEl = document.getElementById('idle-arc');
  const arcOverEl = document.getElementById('idle-arc-over');
  const wedgeEl = document.getElementById('idle-wedge-p');
  const segEl = document.getElementById('idle-seg');
  const segOverEl = document.getElementById('idle-seg-over');
  const progEl = document.getElementById('prog');
  const limitEl = document.getElementById('limit-bar-fill');
  const ringGroup = document.getElementById('idle-ring');
  const barGroup = document.getElementById('idle-bar');
  const appEl = document.getElementById('app');

  // Волна перехода короче всего на fast — 520 мс (--wave-ms). Гашение в 160
  // заканчивается в первой её трети, на med и slow тем более.
  const FADE_MS = 160;

  const R = 156, CX = 165, CY = 165;
  // Сектор наложения шире самой окружности: обводка в 10 нарисована по центру
  // линии, и сектор радиусом R срезал бы её внешнюю половину.
  const WEDGE_R = 220;

  /* ── пресеты ──────────────────────────────────────────────────────
     Кольцо: дуга в arc% окружности рождается у верхней точки за fill,
     крутится turns оборотов за run, потом начало догоняет конец за drain.
     Полоса без seg: заливка слева направо за fill, затем левый край догоняет
     правый за drain. Полоса с seg: отрезок набирается у левого края, делает
     bounces перекладок от края к краю за run и схлопывается за drain. */
  const PRESETS = [
    { el: 'ring', fill: 25,  drain: 25,  arc: 5,  run: 1800, turns: 2 },
    { el: 'ring', fill: 200, drain: 250, arc: 15, run: 1800, turns: 2 },
    { el: 'ring', fill: 300, drain: 350, arc: 20, run: 2750, turns: 2 },
    { el: 'ring', fill: 500, drain: 700, arc: 50, run: 2750, turns: 3 },
    { el: 'ring', fill: 500, drain: 700, arc: 40, run: 3800, turns: 3 },
    { el: 'ring', fill: 400, drain: 450, arc: 15, run: 5850, turns: 3 },
    { el: 'ring', fill: 100, drain: 100, arc: 10, run: 2850, turns: 6 },
    { el: 'bar',  fill: 600, drain: 800 },
    { el: 'bar',  fill: 200, drain: 300, seg: 15, run: 3000, bounces: 2 },
    { el: 'bar',  fill: 400, drain: 500, seg: 25, run: 3000, bounces: 2 },
    { el: 'bar',  fill: 150, drain: 200, seg: 10, run: 4500, bounces: 4 },
    { el: 'bar',  fill: 350, drain: 400, seg: 20, run: 6400, bounces: 4 },
    { el: 'bar',  fill: 200, drain: 200, seg: 5,  run: 6900, bounces: 2 },
  ];
  const span = p => p.fill + (p.run || 0) + p.drain;

  // Короткий эффект возвращается чаще длинного. Границы шкалы — длительности
  // самого короткого и самого длинного пресета набора; правишь набор — правь их.
  const D_MIN = 1400, D_MAX = 7300;
  const PAUSE_MIN = 84, PAUSE_MAX = 156, JITTER = 15;

  // Разброс обязателен: ровный интервал ловится за три-четыре повтора, и
  // ожидание следующего прогона раздражает сильнее самого движения.
  function interval(ms) {
    const base = PAUSE_MIN + (ms - D_MIN) / (D_MAX - D_MIN) * (PAUSE_MAX - PAUSE_MIN);
    const jittered = base + (Math.random() * 2 - 1) * JITTER;
    return Math.min(PAUSE_MAX, Math.max(PAUSE_MIN, jittered)) * 1000;
  }

  /* ── геометрия: угол 0 — верхняя точка, плюс по часовой ───────────────
     Считается с поправкой на поворот: весь svg.dial повёрнут в CSS на -90deg,
     чтобы круг прогресса начинался сверху. Значит внутри viewBox ноль — это
     три часа, и верхней точкой он становится уже после поворота. Без поправки
     всё уезжает на 90 градусов против часовой: дуга стартует с девяти часов,
     а сектор наложения ложится мимо реальной заливки. */
  function point(deg, radius) {
    const a = deg * Math.PI / 180;
    return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
  }
  function arcPath(from, to) {
    if (to - from < 0.01) return '';
    const [x0, y0] = point(from, R);
    const [x1, y1] = point(to, R);
    return `M ${x0} ${y0} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  }
  function wedgePath(share) {
    // Дуга в 360° вырождается в точку, поэтому полный круг — прямоугольником.
    if (share >= 0.999) return 'M 0 0 H 330 V 330 H 0 Z';
    if (share <= 0.001) return '';
    const deg = share * 360;
    const [x0, y0] = point(0, WEDGE_R);
    const [x1, y1] = point(deg, WEDGE_R);
    return `M ${CX} ${CY} L ${x0} ${y0} A ${WEDGE_R} ${WEDGE_R} 0 ${deg > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
  }

  const clamp01 = v => Math.min(1, Math.max(0, v));
  function ringShare() {
    const len = parseFloat(progEl.style.strokeDasharray);
    if (!len) return 0;
    return clamp01(1 - parseFloat(progEl.style.strokeDashoffset) / len);
  }
  const barShare = () => clamp01((parseFloat(limitEl.style.width) || 0) / 100);

  /* ── отрисовка кадра ──────────────────────────────────────────────── */
  function ringFrame(p, t) {
    const arc = p.arc / 100 * 360, turn = 360 * p.turns;
    let from, to;
    if (t < p.fill) {
      from = 0;
      to = arc * (t / p.fill);
    } else if (t < p.fill + p.run) {
      from = turn * ((t - p.fill) / p.run);
      to = from + arc;
    } else {
      from = turn + arc * ((t - p.fill - p.run) / p.drain);
      to = turn + arc;
    }
    const d = arcPath(from, to);
    arcEl.setAttribute('d', d);
    arcOverEl.setAttribute('d', d);
    wedgeEl.setAttribute('d', wedgePath(ringShare()));
  }

  function place(el, left, width) {
    el.style.left = (left * 100) + '%';
    el.style.width = (Math.max(width, 0) * 100) + '%';
  }

  function barFrame(p, t) {
    let left, width;
    if (!p.seg) {
      if (t < p.fill) { left = 0; width = t / p.fill; }
      else { left = (t - p.fill) / p.drain; width = 1 - left; }
    } else {
      const w = p.seg / 100;
      if (t < p.fill) {
        left = 0;
        width = w * (t / p.fill);
      } else if (t < p.fill + p.run) {
        const legs = (t - p.fill) / p.run * p.bounces;
        const leg = Math.floor(legs), pos = legs - leg;
        left = (leg % 2 === 0 ? pos : 1 - pos) * (1 - w);
        width = w;
      } else {
        left = 0;
        width = w * (1 - (t - p.fill - p.run) / p.drain);
      }
    }
    place(segEl, left, width);
    place(segOverEl, left, Math.min(left + width, barShare()) - left);
  }

  function clear() {
    arcEl.setAttribute('d', '');
    arcOverEl.setAttribute('d', '');
    place(segEl, 0, 0);
    place(segOverEl, 0, 0);
  }

  /* ── расписание ───────────────────────────────────────────────────── */
  let last = -1, timer = null, raf = null, current = null, startedAt = 0, fadeAt = 0;

  function pick() {
    let i;
    do { i = Math.floor(Math.random() * PRESETS.length); } while (i === last);
    last = i;
    return PRESETS[i];
  }

  function frame(now) {
    const t = now - startedAt;
    if (t >= span(current)) { finish(); return; }
    if (fadeAt) {
      const gone = (now - fadeAt) / FADE_MS;
      if (gone >= 1) { finish(); return; }
      layer().style.opacity = String(1 - gone);
    }
    current.el === 'ring' ? ringFrame(current, t) : barFrame(current, t);
    raf = requestAnimationFrame(frame);
  }

  const layer = () => (current.el === 'ring' ? ringGroup : barGroup);

  function finish() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    fadeAt = 0;
    ringGroup.style.opacity = '';
    barGroup.style.opacity = '';
    clear();
    const played = current;
    current = null;
    timer = setTimeout(run, interval(span(played)));
  }

  function run() {
    timer = null;
    const p = pick();
    // Вне Focus кольца и полосы на экране нет: играть вхолостую незачем, но и
    // откладывать до возврата нельзя — тогда эффект дёргался бы на входе.
    // Поверх идущего перехода тоже не начинаем: волна и так самый тяжёлый кадр.
    if (root.dataset.mode !== 'focus' || appEl.classList.contains('anim')) {
      timer = setTimeout(run, interval(span(p)));
      return;
    }
    current = p;
    startedAt = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // Первый прогон — сразу после загрузки окна; дальше счётчик тикает от него и
  // на переключение режимов не смотрит.
  function start() {
    if (reduced || timer || raf) return;
    run();
  }

  // Переключение режима: эффект доигрывает как шёл, но уводится в прозрачность.
  // Замораживать последний кадр нельзя — застывшая и потом пропавшая дуга
  // читается как баг, а не как эффект.
  function fade() {
    if (raf && !fadeAt) fadeAt = performance.now();
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    current = null;
    clear();
  }

  return { start, stop, fade };
})();
