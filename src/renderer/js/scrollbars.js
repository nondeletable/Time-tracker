// Бегунок прокрутки виден, пока область прокручивается, и гаснет через паузу
// после последнего события. scroll не всплывает, поэтому слушаем на document в
// фазе захвата: так ловятся все прокручиваемые области, включая те, что
// появятся позже. Цвет и гашение — в style.css, раздел Scrollbar.

const IDLE_MS = 800
const timers = new WeakMap()

document.addEventListener('scroll', e => {
  const el = e.target
  if (!(el instanceof Element)) return
  el.classList.add('scrolling')
  clearTimeout(timers.get(el))
  timers.set(el, setTimeout(() => el.classList.remove('scrolling'), IDLE_MS))
}, { capture: true, passive: true })
