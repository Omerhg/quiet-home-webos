(function () {
  'use strict';
  var KEY = 'quiet-home.wallpaper.v1', INTERVAL = 90000;
  var scenes = [
    {
        "file": "blue-ridges.jpg",
        "title": "Blue mountain ridges"
    },
    {
        "file": "forest-falls.jpg",
        "title": "Forest waterfalls"
    },
    {
        "file": "black-sand-coast.jpg",
        "title": "Icelandic coast"
    },
    {
        "file": "desert-dusk.jpg",
        "title": "Desert at dusk"
    },
    {
        "file": "dolomites-sunrise.jpg",
        "title": "Dolomites sunrise"
    },
    {
        "file": "turquoise-coast.jpg",
        "title": "Turquoise coastline"
    },
    {
        "file": "autumn-canopy.jpg",
        "title": "Autumn forest canopy"
    },
    {
        "file": "northern-lights.jpg",
        "title": "Northern lights"
    },
    {
        "file": "glacial-lagoon.jpg",
        "title": "Glacial lagoon"
    },
    {
        "file": "white-sands.jpg",
        "title": "White Sands at sunset"
    },
    {
        "file": "sunlit-forest.jpg",
        "title": "Sunlit forest"
    },
    {
        "file": "ocean-swell.jpg",
        "title": "Ocean swell"
    }
];
  var selected = scenes.map(function (scene) { return scene.file; });
  var mode = 'rotate', index = 0, timer = null, cleanup = null, generation = 0;
  var host = document.getElementById('wallpapers'), screen = document.getElementById('screen');
  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) {
      if (['rotate', 'still', 'glass'].indexOf(saved.mode) !== -1) mode = saved.mode;
      if (Number.isInteger(saved.index) && saved.index >= 0 && saved.index < scenes.length) index = saved.index;
      if (Array.isArray(saved.selected)) {
        var valid = scenes.filter(function (scene) { return saved.selected.indexOf(scene.file) !== -1; }).map(function (scene) { return scene.file; });
        if (valid.length) selected = valid;
      }
    }
  } catch (e) { /* Fall back to the bundled nature collection. */ }
  if (selected.indexOf(scenes[index].file) === -1) index = nextIndex(index);
  function nextIndex(from) {
    for (var offset = 1; offset <= scenes.length; offset++) {
      var candidate = (from + offset) % scenes.length;
      if (selected.indexOf(scenes[candidate].file) !== -1) return candidate;
    }
    return from;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ mode: mode, index: index, selected: selected })); } catch (e) { /* The current session still works. */ } }
  function schedule() {
    clearTimeout(timer);
    if (mode === 'rotate' && selected.length > 1 && !document.hidden) timer = setTimeout(function () { show(nextIndex(index)); }, INTERVAL);
  }
  function show(next, failures) {
    if (mode === 'glass') return;
    clearTimeout(timer);
    var ticket = ++generation, image = new Image();
    image.className = 'wallpaper'; image.alt = ''; image.decoding = 'async';
    image.onload = function () {
      var decoded = image.decode ? image.decode().catch(function () {}) : Promise.resolve();
      decoded.then(function () {
        if (ticket !== generation || mode === 'glass') return;
        clearTimeout(cleanup);
        // Keep the old scene fully visible underneath until the new one fades in.
        // Only two decoded photographs are retained, even after repeated changes.
        while (host.children.length > 1) host.removeChild(host.firstChild);
        var previous = host.lastElementChild;
        host.appendChild(image); index = next; save();
        screen.classList.add('nature-background'); host.dataset.scene = scenes[index].file;
        if (window.QUIET_GLASS) window.QUIET_GLASS.set(image);
        requestAnimationFrame(function () { requestAnimationFrame(function () { if (ticket === generation) image.classList.add('is-visible'); }); });
        cleanup = setTimeout(function () { if (previous && previous.parentNode === host) host.removeChild(previous); }, 2100);
        schedule();
      });
    };
    image.onerror = function () {
      if (ticket !== generation) return;
      // A damaged asset must not replace a working background or blank the UI.
      if ((failures || 0) + 1 < selected.length) show(nextIndex(next), (failures || 0) + 1);
      else schedule();
    };
    image.src = 'wallpapers/' + scenes[next].file;
  }
  function setMode(next) {
    if (['rotate', 'still', 'glass'].indexOf(next) === -1) return;
    mode = next; save(); clearTimeout(timer);
    if (mode === 'glass') {
      generation++; clearTimeout(cleanup); host.replaceChildren();
      screen.classList.remove('nature-background'); delete host.dataset.scene;
      if (window.QUIET_GLASS) window.QUIET_GLASS.clear();
    } else if (host.children.length) schedule();
    else show(index);
  }
  window.QUIET_WALLPAPERS = {
    mode: function () { return mode; },
    current: function () { return scenes[index].title; },
    photos: function () { return scenes.map(function (scene) { return { file: scene.file, title: scene.title, selected: selected.indexOf(scene.file) !== -1 }; }); },
    toggle: function (file) {
      if (!scenes.some(function (scene) { return scene.file === file; })) return false;
      var position = selected.indexOf(file);
      if (position !== -1 && selected.length === 1) return false;
      if (position === -1) selected.push(file); else selected.splice(position, 1);
      generation++; clearTimeout(timer); save();
      if (mode !== 'glass') {
        if (selected.indexOf(scenes[index].file) === -1) show(nextIndex(index));
        else if (!host.children.length) show(index);
        else schedule();
      }
      return true;
    },
    setMode: setMode,
    next: function () { if (mode === 'glass') { mode = 'still'; save(); } show(nextIndex(index)); }
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(timer); else schedule(); });
  window.addEventListener('pagehide', function () { clearTimeout(timer); clearTimeout(cleanup); });
  if (mode !== 'glass') show(index);
})();
