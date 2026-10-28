(function () {
  'use strict';
  var screen = document.getElementById('screen'), texture = null, revision = 0, cleanup = null, refreshFrame = null;
  // The photograph is blurred once when it changes, rather than sampled and
  // blurred again for every foreground focus animation on the TV compositor.
  screen.classList.add('cached-glass');
  function surfaces() { return Array.from(document.querySelectorAll('.apps-section, .input, .utility-dock')); }
  function refreshNow(fade) {
    var screenRect = screen.getBoundingClientRect(), scale = screenRect.width / 1920;
    surfaces().forEach(function (surface) {
      surface.classList.add('glass-surface');
      if (!texture) return;
      var rect = surface.getBoundingClientRect(), layers = Array.from(surface.children).filter(function (child) { return child.classList.contains('glass-reflection'); });
      var current = layers.filter(function (layer) { return layer.dataset.texture === String(revision); })[0];
      if (!current) {
        while (layers.length > 1) surface.removeChild(layers.shift());
        current = document.createElement('span'); current.className = 'glass-reflection'; current.setAttribute('aria-hidden', 'true'); current.dataset.texture = revision;
        current.style.backgroundImage = 'linear-gradient(145deg,#09142266,#050b1466),url("' + texture + '")';
        surface.prepend(current); layers.push(current);
        // DOM order is independent of the controls; newer reflection layers
        // paint above the previous reflection and below all interactive content.
        current.style.zIndex = '-1';
        layers.forEach(function (layer) { if (layer !== current) layer.style.zIndex = '-2'; });
        if (fade) requestAnimationFrame(function () { requestAnimationFrame(function () { current.classList.add('is-visible'); }); });
        else current.classList.add('is-visible');
      }
      layers.forEach(function (layer) {
        layer.style.backgroundPosition = '0 0,' + (-(rect.left - screenRect.left) / scale) + 'px ' + (-(rect.top - screenRect.top) / scale) + 'px';
      });
    });
  }
  function clear() {
    texture = null; revision++; clearTimeout(cleanup);
    document.querySelectorAll('.glass-reflection').forEach(function (layer) { layer.remove(); });
    delete screen.dataset.glass;
  }
  window.QUIET_GLASS = {
    set: function (image) {
      try {
        var canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
        var context = canvas.getContext('2d'); context.filter = 'blur(8px) saturate(1.35)';
        context.drawImage(image, 0, 0, 640, 360);
        texture = canvas.toDataURL('image/jpeg', .9); revision++;
        screen.dataset.glass = 'cached'; clearTimeout(cleanup); refreshNow(true);
        cleanup = setTimeout(function () {
          document.querySelectorAll('.glass-reflection').forEach(function (layer) { if (layer.dataset.texture !== String(revision)) layer.remove(); });
        }, 2100);
      } catch (e) { clear(); /* Keep the inexpensive dark-glass fallback. */ }
    },
    clear: clear,
    refresh: function () {
      if (refreshFrame !== null) return;
      refreshFrame = requestAnimationFrame(function () { refreshFrame = null; refreshNow(false); });
    }
  };
})();
