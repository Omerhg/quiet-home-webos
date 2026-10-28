(function () {
  'use strict';
  var KEY = 'quiet-home.scene.v1';
  var scenes = ((window.QUIET_SCENE_CONFIG || {}).scenes || []).filter(function (scene) {
    return /^scene\.[a-z0-9_]+$/.test(scene.id) && typeof scene.title === 'string' &&
      /^https?:\/\/[^\s/@?#]+\/api\/webhook\/[A-Za-z0-9_-]+$/.test(scene.url);
  });
  var selected = scenes.length ? scenes[0].id : null, busy = false;
  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.selected === null) selected = null;
    else if (saved && scenes.some(function (scene) { return scene.id === saved.selected; })) selected = saved.selected;
  } catch (e) { /* Keep the default scene when storage is unavailable. */ }
  function current() { return scenes.filter(function (scene) { return scene.id === selected; })[0] || null; }
  window.QUIET_SCENES = {
    list: function () { return scenes.map(function (scene) { return { id: scene.id, title: scene.title, description: scene.description, selected: scene.id === selected }; }); },
    current: function () { var scene = current(); return scene ? { id: scene.id, title: scene.title } : null; },
    select: function (id) {
      if (id !== null && !scenes.some(function (scene) { return scene.id === id; })) return false;
      selected = id;
      try { localStorage.setItem(KEY, JSON.stringify({ selected: selected })); } catch (e) { /* Apply for this session. */ }
      return true;
    },
    activate: function () {
      var scene = current();
      if (!scene) return Promise.reject(new Error('Choose a scene in Settings.'));
      if (busy) return Promise.resolve({ ignored: true });
      busy = true;
      var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 7000);
      // The random local webhook can activate only this configured scene. The TV
      // never receives a Home Assistant account token. Opaque responses mean we
      // report a sent request, rather than claiming the lights have changed.
      return fetch(scene.url, { method: 'POST', mode: 'no-cors', credentials: 'omit',
        cache: 'no-store', signal: controller.signal }).then(function (response) {
        if (response.type !== 'opaque' && !response.ok) throw new Error('Home Assistant could not receive the request.');
        return { title: scene.title, requested: true };
      }).catch(function () { throw new Error('Could not reach Home Assistant. Try again.'); }).finally(function () {
        clearTimeout(timer); busy = false;
      });
    }
  };
})();
