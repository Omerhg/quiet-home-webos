(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function reveal(button) {
    var pane = button.closest('.choices'); if (!pane) return;
    var scale = document.getElementById('screen').getBoundingClientRect().width / 1920;
    var r = button.getBoundingClientRect(), b = pane.getBoundingClientRect();
    if (r.top < b.top + 12) pane.scrollTop -= (b.top + 12 - r.top) / scale;
    else if (r.bottom > b.bottom - 12) pane.scrollTop += (r.bottom - b.bottom + 12) / scale;
    hint();
  }
  function focus(button) { if (button) { button.focus({ preventScroll: true }); reveal(button); } }
  function hint() {
    var pane = $('choices'), target = $('settings-scroll-hint'); if (!pane || !target) return;
    target.textContent = pane.scrollHeight > pane.clientHeight + 4 ? (pane.scrollTop + pane.clientHeight < pane.scrollHeight - 8 ? 'More below ↓' : 'End of list') : '';
  }
  window.QUIET_SETTINGS_NAV = { move: function (code, select) {
    var current = document.activeElement, tabs = Array.from(document.querySelectorAll('#editor .tab'));
    var chosen = document.querySelector('#editor .tab[aria-selected="true"]');
    var all = Array.from($('choices').querySelectorAll('.nav')).filter(function (b) { return !b.disabled; });
    if (tabs.indexOf(current) >= 0) {
      if (code === 38) focus(tabs[tabs.indexOf(current) - 1] || $('close-editor'));
      if (code === 40) focus(tabs[tabs.indexOf(current) + 1] || $('done'));
      if (code === 39) select(current.id.replace('-tab', ''));
      return;
    }
    if (current === $('close-editor')) { if (code === 40 || code === 37) focus(chosen); return; }
    if (current === $('settings-back')) { if (code === 40 || code === 39) focus(all[0]); else if (code === 37) focus(chosen); return; }
    if (current.closest('.editor-footer')) {
      if (code === 38) focus(all[all.length - 1] || chosen);
      if (code === 37) focus($('restore-lg')); if (code === 39) focus($('done')); return;
    }
    if (!all.includes(current)) { focus(chosen); return; }
    var rect = current.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    var vertical = code === 38 || code === 40, direction = code === 37 || code === 38 ? -1 : 1;
    var pool = all.filter(function (b) {
      if (b === current) return false; var r = b.getBoundingClientRect(), dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
      return vertical ? dy * direction > 10 : dx * direction > 10 && Math.abs(dy) < Math.min(rect.height, r.height) * .4;
    });
    if (!pool.length) {
      if (code === 37) focus(chosen);
      if (code === 38) focus(!$('settings-back').hidden ? $('settings-back') : chosen);
      if (code === 40) focus($('done')); return;
    }
    pool.sort(function (a, b) {
      function score(button) { var r = button.getBoundingClientRect(), dx = Math.abs(r.left + r.width / 2 - x), dy = Math.abs(r.top + r.height / 2 - y); return vertical ? dy * 10000 + dx : dx; }
      return score(a) - score(b);
    }); focus(pool[0]);
  } };
  document.addEventListener('focusin', function (event) { if (!$('editor').hidden && event.target.closest('#choices')) reveal(event.target); });
  $('choices').addEventListener('scroll', hint);
  new MutationObserver(hint).observe($('choices'), { childList: true, subtree: true });
  new ResizeObserver(hint).observe($('choices'));
})();
