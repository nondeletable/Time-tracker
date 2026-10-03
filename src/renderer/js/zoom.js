// Сцена Focus считает свои размеры в пикселях экрана, ей нужен зум окна в --k.
// Зум меняет ширину страницы в CSS-пикселях, поэтому resize ловит и его.
// Модуль импортируется первым: fx.js на тот же resize перемеряет кольцо,
// и к этому моменту --k уже должен быть новым.
const syncZoom = () => document.documentElement.style.setProperty('--k', window.api.zoomFactor())
syncZoom()
addEventListener('resize', syncZoom)
