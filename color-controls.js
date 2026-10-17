// Optional visual feedback. The existing drawing app owns all colour state
// and interactions; this file never intercepts an event or changes a colour.
(function () {
  'use strict';
  var pair = document.querySelector('.paint-pair');
  if (!pair) return;
  var dots = [pair.querySelector('.paint-current span'), pair.querySelector('.paint-second span')];
  if (!dots[0] || !dots[1] || !Element.prototype.animate) return;
  var motion = [], overlay = null, frame = 0;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function clearMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    motion.forEach(function (animation) { animation.cancel(); });
    motion = [];
    if (overlay) overlay.remove();
    overlay = null;
  }
  function snapshot() {
    return dots.map(function (dot) {
      var style = getComputedStyle(dot), rect = dot.getBoundingClientRect();
      return { color: style.backgroundColor, shadow: style.boxShadow,
        x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
  }
  function piece(className, rect, bounds) {
    var el = document.createElement('i');
    el.className = className;
    el.style.left = (rect.x - bounds.x) + 'px';
    el.style.top = (rect.y - bounds.y) + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    overlay.appendChild(el);
    return el;
  }
  function animateSwap(before) {
    if (reduced.matches || !document.contains(pair)) return;
    var after = snapshot();
    // Animate only a swap actually performed by the drawing app.
    if (before[0].color === before[1].color ||
        after[0].color !== before[1].color || after[1].color !== before[0].color) return;
    var bounds = pair.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    overlay = document.createElement('div');
    overlay.className = 'color-swap-motion';
    overlay.setAttribute('aria-hidden', 'true');
    pair.appendChild(overlay);
    after.forEach(function (rect) { piece('swap-well', rect, bounds); });
    var currentOverlay = overlay;
    before.forEach(function (origin, i) {
      var dest = after[1 - i], disc = piece('swap-disc', origin, bounds);
      disc.style.background = origin.color;
      disc.style.boxShadow = origin.shadow;
      var dx = dest.x + dest.width / 2 - origin.x - origin.width / 2;
      var dy = dest.y + dest.height / 2 - origin.y - origin.height / 2;
      var scale = dest.width / origin.width;
      motion.push(disc.animate([
        { transform: 'translate(0, 0) scale(1)' },
        { transform: 'translate(' + dx / 2 + 'px, ' + (dy / 2 + (i ? 5 : -5)) + 'px) scale(' + (1 + scale) / 2 + ')', offset: .5 },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')' }
      ], { duration: 320, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' }));
    });
    Promise.all(motion.map(function (animation) { return animation.finished; })).then(function () {
      if (overlay === currentOverlay) clearMotion();
    }).catch(function () {
      if (overlay === currentOverlay) clearMotion();
    });
  }
  function prepareSwap() {
    try {
      clearMotion();
      if (reduced.matches) return;
      var before = snapshot();
      // Wait until the app's existing click/keyboard handler has finished.
      frame = requestAnimationFrame(function () {
        frame = 0;
        try { animateSwap(before); } catch (error) { clearMotion(); }
      });
    } catch (error) { clearMotion(); }
  }
  pair.addEventListener('click', function (event) {
    if (event.target.closest('.paint-swap')) prepareSwap();
  }, true);
  document.addEventListener('keydown', function (event) {
    if (event.key.toLowerCase() !== 'x' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.isContentEditable || event.target.closest('input, textarea, select')) return;
    prepareSwap();
  }, true);
  // Cancel decoration before any new gesture; dragging remains immediate.
  document.addEventListener('pointerdown', clearMotion, true);
  window.addEventListener('resize', clearMotion);
  window.addEventListener('blur', clearMotion);
  if (reduced.addEventListener) reduced.addEventListener('change', clearMotion);
})();
