(function () {
  'use strict';
  var callback = null, downSeen = false, lastDispatch = 0, lastSource = '', guard = false, orphanUntil = 0;
  function isBack(event) {
    var code = event.keyCode || event.which;
    var key = event.key || event.code;
    if (code === 8 && event.target && event.target.closest && event.target.closest('textarea, input:not([type=range]), [contenteditable=true]')) return false;
    return [461, 27, 8].indexOf(code) >= 0 || ['BrowserBack', 'GoBack', 'Back', 'Escape', 'Esc', 'Backspace'].indexOf(key) >= 0;
  }
  function dispatch(source) {
    var now = Date.now();
    // A platform can deliver both a key event and a history pop for one press.
    if (lastSource && lastSource !== source && now - lastDispatch < 80) return;
    lastDispatch = now; lastSource = source;
    if (callback) callback();
  }
  function prevent(event) { if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation(); }
  window.addEventListener('keydown', function (event) {
    if (!callback || !isBack(event)) return;
    prevent(event); downSeen = true;
    if (!event.repeat) dispatch('key');
  }, true);
  window.addEventListener('keyup', function (event) {
    if (!callback || !isBack(event)) return;
    prevent(event);
    if (!downSeen && Date.now() >= orphanUntil) dispatch('key');
    downSeen = false;
  }, true);
  function rearm() {
    try { history.pushState({ quietBackGuard: true }, '', location.href); guard = true; } catch (e) { guard = false; }
  }
  window.addEventListener('popstate', function () {
    if (!callback || !guard) return;
    rearm(); dispatch('history');
  });
  function resumed() { downSeen = false; orphanUntil = Date.now() + 300; }
  window.addEventListener('blur', function () { downSeen = false; });
  document.addEventListener('visibilitychange', function () { if (document.hidden) downSeen = false; else resumed(); });
  window.QUIET_BACK = {
    isBack: isBack,
    resumed: resumed,
    install: function (handler) {
      callback = handler;
      try { history.scrollRestoration = 'manual'; history.replaceState({ quietBackBase: true }, '', location.href); rearm(); } catch (e) { /* Key capture still works when history is unavailable. */ }
    }
  };
})();
