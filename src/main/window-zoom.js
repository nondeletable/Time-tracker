// The whole interface was laid out and checked on a 1280x812 window. A larger
// window does not get a second layout - it gets the same one, scaled up until it
// meets the nearer edge. A smaller one keeps factor 1: below 1280x812 the layout
// already adapts on its own, and shrinking text there would only hurt.

const BASE_WIDTH  = 1280
const BASE_HEIGHT = 812

function zoomFor(width, height) {
  return Math.max(1, Math.min(width / BASE_WIDTH, height / BASE_HEIGHT))
}

module.exports = { zoomFor, BASE_WIDTH, BASE_HEIGHT }
