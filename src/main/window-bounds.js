// Чистая валидация сохранённых bounds окна — без Electron. UMD: node + браузер.
(function (root, factory) {
  const api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.WINDOW_BOUNDS = api
})(globalThis, function () {
  // Возвращает bounds, если верхний центр окна (x + width/2, y) попадает в
  // рабочую область какого-либо дисплея (титлбар доступен для перетаскивания);
  // иначе null — вызывающий откатывается к дефолту.
  function clampBoundsToScreen(bounds, displays) {
    if (!bounds ||
        typeof bounds.x !== 'number' || typeof bounds.y !== 'number' ||
        typeof bounds.width !== 'number' || typeof bounds.height !== 'number') {
      return null
    }
    const px = bounds.x + bounds.width / 2
    const py = bounds.y
    const ok = (displays || []).some(d => {
      const wa = d && d.workArea
      if (!wa) return false
      return px >= wa.x && px < wa.x + wa.width && py >= wa.y && py < wa.y + wa.height
    })
    return ok ? bounds : null
  }

  return { clampBoundsToScreen }
})
