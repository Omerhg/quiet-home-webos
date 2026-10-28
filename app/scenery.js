(function () {
  'use strict';
  var screen = document.getElementById('screen'), timer, sleeping = false, previous = null;
  var enabled = true, blockedKeys = {}, ignoreClickUntil = 0;
  var surfaces = Array.from(document.querySelectorAll('.apps-section, .inputs-section, #home-tools'));
  try { enabled = localStorage.getItem('quiet-home.scenery.v1') !== 'off'; } catch (e) {}
  function wake() {
    if (!sleeping) return;
    sleeping = false; screen.classList.remove('scenery-mode');
    if (window.QUIET_WALLPAPERS.endAmbient) window.QUIET_WALLPAPERS.endAmbient();
    document.dispatchEvent(new CustomEvent('quiet-scenery-change', { detail: { active: false } }));
    surfaces.forEach(function (node) { node.inert = false; });
    document.getElementById('scenery-overlay').hidden = true;
    if (previous && previous.isConnected) previous.focus({ preventScroll: true });
  }
  function schedule() {
    clearTimeout(timer);
    if (!enabled || document.hidden || sleeping) return;
    timer = setTimeout(enter, 30000);
  }
  function enter(options) {
      if (sleeping) return;
      if (document.hidden || document.querySelector('[role="dialog"]:not([hidden]), .reordering')) return;
      if (options && options.picture && window.QUIET_WALLPAPERS.startAmbient) window.QUIET_WALLPAPERS.startAmbient();
      previous = document.activeElement; if (previous) previous.blur();
      surfaces.forEach(function (node) { node.inert = true; });
      document.getElementById('scenery-overlay').hidden = false;
      sleeping = true; screen.classList.add('scenery-mode');
      document.dispatchEvent(new CustomEvent('quiet-scenery-change', { detail: { active: true } }));

  }
  function stop(event) { if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation(); }
  function activity(event) {
    var key = event.keyCode;
    if ((event.type === 'keydown' || event.type === 'keyup') && blockedKeys[key]) {
      if (event.type === 'keyup') delete blockedKeys[key]; stop(event); schedule(); return;
    }
    if ((event.type === 'click' || event.type === 'mousedown' || event.type === 'mouseup') && Date.now() < ignoreClickUntil) {
      stop(event); schedule(); return;
    }
    if (sleeping) {
      if (event.type === 'keydown') blockedKeys[key] = true;
      if (['pointerdown', 'mousedown', 'touchstart'].indexOf(event.type) >= 0) ignoreClickUntil = Date.now() + 700;
      wake(); stop(event);
    }
    schedule();
  }
  ['keydown', 'keyup', 'pointermove', 'mousemove', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'wheel'].forEach(function (type) {
    document.addEventListener(type, activity, { capture: true, passive: false });
  });
  document.addEventListener('visibilitychange', function () { clearTimeout(timer); wake(); blockedKeys = {}; if (!document.hidden) schedule(); });
  window.addEventListener('blur', function () { clearTimeout(timer); wake(); blockedKeys = {}; });
  window.addEventListener('focus', schedule);
  window.QUIET_SCENERY = {
    wake: function () { wake(); schedule(); },
    enter: enter,
    active: function () { return sleeping; },
    enabled: function () { return enabled; },
    toggle: function () { enabled = !enabled; try { localStorage.setItem('quiet-home.scenery.v1', enabled ? 'on' : 'off'); } catch (e) {} wake(); schedule(); }
  };
  schedule();
})();
