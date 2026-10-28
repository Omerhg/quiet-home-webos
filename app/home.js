(function () {
  'use strict';
  var catalog = window.HOME_CATALOG || { apps: [], inputs: [] };
  var defaults = window.HOME_DEFAULTS || { favorites: [], inputs: [] };
  var STORAGE_KEY = 'quiet-home.preferences.v1';
  var $ = function (id) { return document.getElementById(id); };
  var editorOpen = false, exitOpen = false, controlsOpen = false, beforeControls = null, lightsOpen = false, beforeLights = null, beforeExit = null, editorTab = 'apps', beforeEditor = null, moving = null, holdTimer = null, held = false, toastTimer;
  var COLUMNS = 4, navigationX = null, navigationCache = null, appearancePhotos = false, keyboardNavigation = false, pointerX = null, pointerY = null;
  function invalidateNavigation() { navigationCache = null; }
  var bridges = [];
  var icons = {
    edit: '<svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    check: '<svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-8"/></svg>',
    hdmi: '<svg viewBox="0 0 48 48"><path d="M11 13h26v17l-7 7H18l-7-7zM16 13V8h16v5M18 21h12M18 26h12M19 37v5m10-5v5"/></svg>',
    playstation: '<svg viewBox="0 0 48 48"><path d="M15 18h18c5 0 9 16 7 19-2 3-7-3-10-5H18c-3 2-8 8-10 5-2-3 2-19 7-19zM16 23v10m-5-5h10M31 24h.1M36 29h.1M24 18v-5"/><circle cx="31" cy="24" r="1"/><circle cx="36" cy="29" r="1"/></svg>',
    switch: '<svg viewBox="0 0 48 48"><rect x="10" y="7" width="12" height="34" rx="6"/><rect x="26" y="7" width="12" height="34" rx="6"/><circle cx="16" cy="17" r="2.3"/><circle cx="32" cy="30" r="2.3"/><path d="M16 28v5m-2.5-2.5h5M31 16h.1m3 3h.1"/></svg>',
    soundbar: '<svg viewBox="0 0 48 48"><rect x="3" y="20" width="42" height="11" rx="5.5"/><path d="M9 25.5h2m5 0h2m5 0h2m5 0h2m5 0h2M19 12c3-2 7-2 10 0m-13-5c5-4 11-4 16 0"/></svg>'
  };
  function validKeys(keys, list) { return Array.isArray(keys) ? keys.filter(function (k, i) { return typeof k === 'string' && keys.indexOf(k) === i && list.some(function (x) { return x.key === k; }); }) : []; }
  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.favorites) && Array.isArray(saved.inputs)) return { favorites: validKeys(saved.favorites, catalog.apps), inputs: validKeys(saved.inputs, catalog.inputs) };
    } catch (e) { /* Use defaults when storage is unavailable or invalid. */ }
    return { favorites: validKeys(defaults.favorites, catalog.apps), inputs: validKeys(defaults.inputs, catalog.inputs) };
  }
  var preferences = load();
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch (e) { toast('Changes will last until this app closes.'); } }
  function get(list, key) { return list.filter(function (x) { return x.key === key; })[0]; }
  function rgb(hex) { var n = parseInt((hex || '#7d83a5').slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].join(','); }
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { $('toast').classList.remove('visible'); }, 2800); }
  function service(uri, parameters, callback) {
    if (typeof PalmServiceBridge === 'undefined') { callback({ returnValue: false, preview: true }); return; }
    var b = new PalmServiceBridge(), finished = false;
    function done(result) {
      if (finished) return; finished = true; clearTimeout(timer);
      var index = bridges.indexOf(b); if (index >= 0) bridges.splice(index, 1);
      callback(result);
    }
    var timer = setTimeout(function () { if (b.cancel) b.cancel(); done({ returnValue: false }); }, 7000);
    b.onservicecallback = function (text) { try { done(JSON.parse(text)); } catch (e) { done({ returnValue: false }); } };
    bridges.push(b);
    try { b.call(uri, JSON.stringify(parameters || {})); } catch (e) { done({ returnValue: false }); }
  }
  function launch(item) {
    service('luna://com.webos.applicationManager/launch', { id: item.id, params: item.params || {} }, function (result) {
      if (result.preview) toast(item.title + ' · preview');
      else if (result.returnValue === false) toast('Could not open ' + item.title + '.');
    });
  }
  function appArtwork(app) {
    var holder = document.createElement('span'); holder.className = 'app-card'; holder.style.setProperty('--tile-rgb', rgb(app.color));
    if (app.icon) {
      var img = document.createElement('img'); img.className = 'app-logo'; img.src = app.icon; img.alt = ''; img.draggable = false;
      img.onerror = function () { holder.textContent = ''; var mark = document.createElement('span'); mark.className = 'brand-mark'; mark.textContent = app.title; holder.appendChild(mark); };
      holder.appendChild(img);
    } else { var mark = document.createElement('span'); mark.className = 'brand-mark'; mark.textContent = app.title; holder.appendChild(mark); }
    return holder;
  }
  function renderHome(focusKey) {
    invalidateNavigation();
    navigationX = null;
    var apps = $('apps'), inputs = $('inputs'); apps.replaceChildren(); inputs.replaceChildren();
    preferences.favorites.forEach(function (key) {
      var app = get(catalog.apps, key), b = document.createElement('button');
      b.className = 'app nav'; b.dataset.key = key; b.dataset.brand = app.id; b.setAttribute('aria-label', app.title);
      b.appendChild(appArtwork(app));
      var label = document.createElement('span'); label.className = 'app-label'; label.textContent = app.title; b.appendChild(label);
      if (moving && moving.key === key) b.classList.add('reordering');
      b.addEventListener('click', function () { if (held) { held = false; return; } if (moving) finishMove(true); else launch(app); });
      b.addEventListener('pointerdown', function () { startHold(b); });
      b.addEventListener('pointerup', clearHold); b.addEventListener('pointerleave', clearHold);
      apps.appendChild(b);
    });
    preferences.inputs.forEach(function (key) {
      var item = get(catalog.inputs, key), b = document.createElement('button'); b.className = 'input nav'; b.dataset.key = key;
      var glyph = document.createElement('span'); glyph.className = 'input-icon'; glyph.innerHTML = icons[item.glyph] || icons.hdmi;
      var copy = document.createElement('span'); copy.className = 'input-copy';
      var title = document.createElement('span'); title.className = 'input-name'; title.textContent = item.title;
      var sub = document.createElement('span'); sub.className = 'input-meta'; sub.textContent = item.subtitle;
      copy.append(title, sub); b.append(glyph, copy); b.addEventListener('click', function () { launch(item); }); inputs.appendChild(b);
    });
    $('empty-apps').hidden = preferences.favorites.length !== 0;
    $('inputs-heading').parentElement.parentElement.hidden = preferences.inputs.length === 0;
    $('arrange-hint').textContent = moving ? 'Move with arrows · OK to save · Back to cancel' : '';
    if (window.QUIET_GLASS) window.QUIET_GLASS.refresh();
    if (focusKey) { var el = Array.from(document.querySelectorAll('#apps .nav, #inputs .nav')).filter(function (x) { return x.dataset.key === focusKey; })[0]; if (el) el.focus(); }
  }
  var settingsPages = {
    apps: ['Apps', 'Choose the apps that appear on Home. Hold OK on a Home tile to change its position.'],
    inputs: ['Inputs', 'Keep the connections you use within easy reach.'],
    appearance: ['Background', 'Choose a look and the landscapes you love.'],
    scenery: ['Scenery', 'A quieter Home when you put the remote down.'],
    scenes: ['Scene button', 'Choose the scene that the central Home button activates.'],
    remote: ['Remote', 'Give your shortcut buttons a purpose.']
  }, settingsPositions = {};
  function settingsHeading(title, description, summary) {
    $('settings-title').textContent = title; $('editor-description').textContent = description;
    $('settings-summary').textContent = summary || ''; $('settings-panel').setAttribute('aria-labelledby', editorTab + '-tab');
  }
  function focusSetting(selector) {
    keyboardNavigation = true;
    var button = $('choices').querySelector(selector); if (button) button.focus({ preventScroll: true });
  }
  function renderChoices(focusKey) {
    invalidateNavigation(); navigationX = null;
    Object.keys(settingsPages).forEach(function (key) { $(key + '-tab').setAttribute('aria-selected', String(editorTab === key)); });
    $('choices').className = 'choices'; $('choices').dataset.page = editorTab;
    $('settings-back').hidden = !(editorTab === 'appearance' && appearancePhotos);
    settingsHeading(settingsPages[editorTab][0], settingsPages[editorTab][1]);
    if (editorTab === 'appearance') { if (appearancePhotos) renderRotationPhotos(); else renderAppearance(focusKey); return; }
    if (editorTab === 'scenery') { renderScenery(); return; }
    if (editorTab === 'scenes') { renderScenes(focusKey); return; }
    if (editorTab === 'remote') { renderRemote(); return; }
    var list = editorTab === 'apps' ? catalog.apps.slice() : catalog.inputs;
    var selected = editorTab === 'apps' ? preferences.favorites : preferences.inputs;
    if (editorTab === 'apps') list.sort(function (a, b) { var ai = selected.indexOf(a.key), bi = selected.indexOf(b.key); return ai >= 0 && bi >= 0 ? ai - bi : ai >= 0 ? -1 : bi >= 0 ? 1 : a.title.localeCompare(b.title); });
    $('choices').setAttribute('aria-label', 'Choose ' + editorTab); $('choices').replaceChildren();
    $('choices').classList.add('settings-selection');
    $('settings-summary').textContent = selected.length + ' selected';
    list.forEach(function (item) {
      var button = document.createElement('button'); button.className = 'choice nav'; button.dataset.choice = item.key;
      button.setAttribute('aria-pressed', String(selected.indexOf(item.key) !== -1));
      if (item.icon) { var img = document.createElement('img'); img.src = item.icon; img.alt = ''; button.appendChild(img); }
      else { var mark = document.createElement('span'); mark.className = 'choice-mark'; if (editorTab === 'apps') mark.textContent = item.title.slice(0, 1); else mark.innerHTML = icons[item.glyph] || icons.hdmi; button.appendChild(mark); }
      var copy = document.createElement('span'); copy.className = 'appearance-copy';
      var name = document.createElement('span'); name.textContent = item.title; copy.appendChild(name);
      if (item.subtitle) { var subtitle = document.createElement('small'); subtitle.textContent = item.subtitle; copy.appendChild(subtitle); }
      var check = document.createElement('span'); check.className = 'choice-check'; if (selected.indexOf(item.key) !== -1) check.innerHTML = icons.check;
      button.append(copy, check);
      button.addEventListener('click', function () {
        var index = selected.indexOf(item.key); if (index === -1) selected.push(item.key); else selected.splice(index, 1);
        save(); renderHome(); button.setAttribute('aria-pressed', String(index === -1)); check.innerHTML = index === -1 ? icons.check : '';
        $('settings-summary').textContent = selected.length + ' selected';
      }); $('choices').appendChild(button);
    });
    if (focusKey) Array.from($('choices').children).some(function (button) { if (button.dataset.choice === focusKey) { button.focus({ preventScroll: true }); return true; } return false; });
  }
  function settingRow(key, title, description, action, options) {
    options = options || {};
    var button = document.createElement('button'); button.className = 'choice appearance-choice nav'; button.dataset.choice = key;
    var copy = document.createElement('span'); copy.className = 'appearance-copy';
    var name = document.createElement('span'); name.textContent = title; var detail = document.createElement('small'); detail.textContent = description; copy.append(name, detail);
    var trailing = document.createElement('span'); trailing.className = options.toggle ? 'setting-switch' : 'setting-trailing'; trailing.setAttribute('aria-hidden', 'true');
    if (options.toggle) { button.setAttribute('role', 'switch'); button.setAttribute('aria-checked', String(options.on)); trailing.appendChild(document.createElement('i')); }
    else trailing.textContent = options.trailing || '›';
    button.append(copy, trailing); button.addEventListener('click', function () { action(button); }); $('choices').appendChild(button); return button;
  }
  function renderAppearance(focusKey) {
    invalidateNavigation();
    var wallpapers = window.QUIET_WALLPAPERS; $('choices').replaceChildren(); $('choices').setAttribute('aria-label', 'Background appearance');
    var modes = document.createElement('div'); modes.className = 'background-modes'; $('choices').appendChild(modes);
    [ ['rotate', 'Rotate nature views', 'A new landscape every 90 seconds'], ['still', 'Keep this view', 'Stay with the current landscape'], ['glass', 'Dark glass', 'A quiet, dark background'] ].forEach(function (item) {
      var button = document.createElement('button'); button.className = 'nav background-mode'; button.dataset.choice = item[0]; button.setAttribute('aria-pressed', String(wallpapers.mode() === item[0]));
      var preview = document.createElement('span'); preview.className = 'background-mode-preview ' + item[0];
      if (item[0] !== 'glass') { var photo = wallpapers.photos().filter(function (p) { return p.title === wallpapers.current(); })[0] || wallpapers.photos()[0]; preview.style.backgroundImage = 'url("wallpapers/thumbs/' + photo.file + '")'; }
      var time = document.createElement('span'); time.textContent = '09:41'; preview.appendChild(time);
      var title = document.createElement('strong'); title.textContent = item[1]; var description = document.createElement('small'); description.textContent = item[2];
      button.append(preview, title, description); button.addEventListener('click', function () {
        wallpapers.setMode(item[0]); modes.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.choice === wallpapers.mode())); });
      }); modes.appendChild(button);
    });
    settingRow('photos', 'Choose rotation photos', wallpapers.photos().filter(function (p) { return p.selected; }).length + ' of ' + wallpapers.photos().length + ' landscapes selected', function () {
      appearancePhotos = true; renderChoices(); focusSetting('.photo-choice');
    });
    settingRow('next', 'Next nature view', 'Preview another selected landscape', function (button) { wallpapers.next(); button.querySelector('small').textContent = wallpapers.current(); modes.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.choice === wallpapers.mode())); }); });
    if (focusKey) focusSetting('[data-choice="' + focusKey + '"]');
  }
  function renderScenery() {
    $('choices').replaceChildren(); $('choices').setAttribute('aria-label', 'Scenery settings');
    var preview = document.createElement('div'); preview.className = 'scenery-preview';
    var photo = window.QUIET_WALLPAPERS.photos().filter(function (p) { return p.title === window.QUIET_WALLPAPERS.current(); })[0];
    if (photo && window.QUIET_WALLPAPERS.mode() !== 'glass') preview.style.backgroundImage = 'url("wallpapers/thumbs/' + photo.file + '")';
    var date = document.createElement('span'); date.textContent = $('date').textContent; var time = document.createElement('strong'); time.textContent = $('clock').textContent; preview.append(date, time); $('choices').appendChild(preview);
    settingRow('scenery', 'Scenery mode', 'Hide tiles after 30 seconds without activity', function (button) {
      window.QUIET_SCENERY.toggle(); button.setAttribute('aria-checked', String(window.QUIET_SCENERY.enabled()));
    }, { toggle: true, on: window.QUIET_SCENERY.enabled() });
    var note = document.createElement('p'); note.className = 'settings-note'; note.textContent = 'Move the pointer or press OK to return. Scenery waits while you use Settings or Home controls.'; $('choices').appendChild(note);
  }
  function renderRotationPhotos() {
    invalidateNavigation(); var wallpapers = window.QUIET_WALLPAPERS, choices = $('choices');
    choices.replaceChildren(); choices.classList.add('photo-choices'); choices.scrollTop = 0; choices.setAttribute('aria-label', 'Photos in rotation');
    settingsHeading('Your landscapes', 'Select the photos you want in rotation. Keep at least one selected.');
    function updateCount() { var photos = wallpapers.photos(); $('settings-summary').textContent = photos.filter(function (photo) { return photo.selected; }).length + ' of ' + photos.length + ' selected'; }
    updateCount();
    wallpapers.photos().forEach(function (photo) {
      var button = document.createElement('button'); button.className = 'nav photo-choice'; button.dataset.photo = photo.file;
      button.setAttribute('aria-label', photo.title); button.setAttribute('aria-pressed', String(photo.selected));
      var image = document.createElement('img'); image.className = 'photo-preview'; image.src = 'wallpapers/thumbs/' + photo.file; image.alt = '';
      var copy = document.createElement('span'); copy.className = 'photo-caption'; var title = document.createElement('span'); title.textContent = photo.title;
      var check = document.createElement('span'); check.className = 'choice-check'; if (photo.selected) check.innerHTML = icons.check;
      copy.append(title, check); button.append(image, copy);
      button.addEventListener('click', function () {
        if (!wallpapers.toggle(photo.file)) { toast('Keep at least one photo selected.'); return; }
        var selected = wallpapers.photos().some(function (item) { return item.file === photo.file && item.selected; });
        button.setAttribute('aria-pressed', String(selected)); check.innerHTML = selected ? icons.check : ''; updateCount();
      }); choices.appendChild(button);
    });
  }
  function renderRemote() {
    $('choices').replaceChildren(); $('choices').setAttribute('aria-label', 'Remote settings');
    settingRow('remote-apps', 'App shortcut buttons', 'Choose an app for Netflix, Prime Video and other app buttons', function () { openRemote('apps'); });
    settingRow('remote-actions', 'Other shortcut buttons', 'Guide, Home Hub and the custom button · apps, inputs and Home features', function () { openRemote('features'); });
    var note = document.createElement('p'); note.className = 'settings-note'; note.textContent = 'The button editor reads the TV’s current assignments and offers Restore original for each button. AI, power and navigation keys remain system-controlled.'; $('choices').appendChild(note);
  }
  function openRemote(group) {
    if (typeof PalmServiceBridge === 'undefined') { window.location.href = 'remote.html?group=' + group; return; }
    launch({ id: 'com.webos.app.voiceweb', title: 'Remote settings', params: { URL: 'file:///media/developer/apps/usr/palm/applications/com.quiet.home/remote.html?group=' + group, source: 'quiet-remote-settings' } });
  }
  function selectSettings(key, focusContent) {
    if (!settingsPages[key]) return;
    settingsPositions[editorTab] = $('choices').scrollTop; editorTab = key; appearancePhotos = false;
    renderChoices(); $('choices').scrollTop = settingsPositions[key] || 0;
    if (focusContent) { var first = $('choices').querySelector('.nav'); if (first) first.focus({ preventScroll: true }); }
  }
  function updateSceneButton() {
    invalidateNavigation();
    var scene = window.QUIET_SCENES.current();
    $('scene-button').hidden = !scene; document.querySelector('.utility-dock').classList.toggle('has-scene', !!scene);
    if (scene) { $('scene-button-label').textContent = scene.title; $('scene-button').setAttribute('aria-label', 'Activate ' + scene.title); }
    if (window.QUIET_GLASS) window.QUIET_GLASS.refresh();
  }
  function renderScenes(focusKey) {
    invalidateNavigation();
    $('choices').replaceChildren(); $('choices').setAttribute('aria-label', 'Home Assistant scene button');
    $('editor-description').textContent = 'Selecting a scene here does not activate it.';
    var current = window.QUIET_SCENES.current();
    var items = [{ id: null, title: 'No scene button', description: 'Keep Home focused on your apps and inputs', selected: !current }].concat(window.QUIET_SCENES.list());
    items.forEach(function (scene) {
      var b = document.createElement('button'); b.className = 'choice appearance-choice nav'; b.dataset.scene = scene.id || 'none';
      b.setAttribute('aria-pressed', String(scene.selected));
      var mark = document.createElement('span'); mark.className = 'choice-mark'; mark.textContent = scene.id ? '✧' : '−';
      var copy = document.createElement('span'); copy.className = 'appearance-copy';
      var title = document.createElement('span'); title.textContent = scene.title;
      var description = document.createElement('small'); description.textContent = scene.description;
      copy.append(title, description);
      var check = document.createElement('span'); check.className = 'choice-check'; if (scene.selected) check.innerHTML = icons.check;
      b.append(mark, copy, check); b.addEventListener('click', function () { window.QUIET_SCENES.select(scene.id); updateSceneButton(); renderScenes(scene.id || 'none'); });
      $('choices').appendChild(b);
    });
    if (focusKey) Array.from($('choices').children).some(function (b) { if (b.dataset.scene === focusKey) { b.focus(); return true; } return false; });
  }
  function openEditor() {
    invalidateNavigation();
    navigationX = null;
    if (moving) finishMove(true); beforeEditor = document.activeElement; editorOpen = true;
    $('editor').hidden = false; $('backdrop').hidden = false;
    document.querySelector('.header').inert = true; document.querySelector('.apps-section').inert = true; document.querySelector('.inputs-section').inert = true; $('home-tools').inert = true;
    renderChoices(); $(editorTab + '-tab').focus();
  }
  function openLights() {
    invalidateNavigation(); navigationX = null; clearHold(); if (moving) finishMove(true);
    beforeLights = document.activeElement; lightsOpen = true; $('lights-dialog').hidden = false; $('backdrop').hidden = false;
    document.querySelector('.header').inert = true; document.querySelector('.apps-section').inert = true; document.querySelector('.inputs-section').inert = true; $('home-tools').inert = true;
    window.QUIET_LIGHTS.open(invalidateNavigation); $('lights-close').focus({ preventScroll: true });
  }
  function closeLights() {
    invalidateNavigation(); navigationX = null; lightsOpen = false; window.QUIET_LIGHTS.close();
    $('lights-dialog').hidden = true; $('backdrop').hidden = true;
    document.querySelector('.header').inert = false; document.querySelector('.apps-section').inert = false; document.querySelector('.inputs-section').inert = false; $('home-tools').inert = false;
    if (beforeLights && beforeLights.isConnected) beforeLights.focus({ preventScroll: true }); else $('lights-open').focus({ preventScroll: true });
  }
  function openControls() {
    invalidateNavigation(); navigationX = null; clearHold(); if (moving) finishMove(true);
    beforeControls = document.activeElement; controlsOpen = true; $('controls-dialog').hidden = false; $('backdrop').hidden = false;
    document.querySelector('.header').inert = true; document.querySelector('.apps-section').inert = true; document.querySelector('.inputs-section').inert = true; $('home-tools').inert = true;
    window.QUIET_CONTROLS.open(invalidateNavigation); $('controls-close').focus({ preventScroll: true });
  }
  function closeControls() {
    invalidateNavigation(); navigationX = null; controlsOpen = false; window.QUIET_CONTROLS.close();
    $('controls-dialog').hidden = true; $('backdrop').hidden = true;
    document.querySelector('.header').inert = false; document.querySelector('.apps-section').inert = false; document.querySelector('.inputs-section').inert = false; $('home-tools').inert = false;
    if (beforeControls && beforeControls.isConnected) beforeControls.focus({ preventScroll: true }); else $('controls-open').focus({ preventScroll: true });
  }
  function closeEditor() {
    invalidateNavigation();
    navigationX = null;
    editorOpen = false; $('editor').hidden = true; $('backdrop').hidden = true;
    document.querySelector('.header').inert = false; document.querySelector('.apps-section').inert = false; document.querySelector('.inputs-section').inert = false; $('home-tools').inert = false;
    if (beforeEditor && beforeEditor.isConnected) beforeEditor.focus(); else $('edit-home').focus();
  }
  function returnToLG() {
    if (typeof PalmServiceBridge === 'undefined') { toast('LG Home · preview'); closeExit(); return; }
    // Visit LG's app explicitly, even when Quiet Home becomes the system default.
    service('luna://com.webos.applicationManager/launch', { id: 'com.webos.app.home', params: {} }, function (result) {
      if (result.returnValue === false) { toast('Could not open LG Home.'); return; }
      if (exitOpen) closeExit();
      if (editorOpen) closeEditor();
    });
  }
  function openExit() {
    invalidateNavigation();
    navigationX = null;
    beforeExit = document.activeElement; exitOpen = true;
    $('exit-dialog').hidden = false; $('backdrop').hidden = false;
    document.querySelector('.header').inert = true; document.querySelector('.apps-section').inert = true; document.querySelector('.inputs-section').inert = true; $('home-tools').inert = true;
    $('cancel-exit').focus();
  }
  function closeExit() {
    invalidateNavigation();
    if (!exitOpen) return; navigationX = null; exitOpen = false; $('exit-dialog').hidden = true; $('backdrop').hidden = true;
    document.querySelector('.header').inert = false; document.querySelector('.apps-section').inert = false; document.querySelector('.inputs-section').inert = false; $('home-tools').inert = false;
    if (beforeExit && beforeExit.isConnected) beforeExit.focus(); else $('edit-home').focus();
  }
  function startHold(button) {
    clearHold(); if (editorOpen || moving || !button || !button.classList.contains('app')) return;
    held = false; holdTimer = setTimeout(function () { held = true; moving = { key: button.dataset.key, before: preferences.favorites.slice() }; renderHome(moving.key); }, 600);
  }
  function clearHold() { clearTimeout(holdTimer); holdTimer = null; }
  function finishMove(commit) {
    if (!moving) return; var key = moving.key; if (!commit) preferences.favorites = moving.before; moving = null; if (commit) save(); renderHome(key);
  }
  function moveFavorite(code) {
    var index = preferences.favorites.indexOf(moving.key), target = index;
    if (code === 37) target--; if (code === 39) target++; if (code === 38) target -= COLUMNS; if (code === 40) target += COLUMNS;
    if (target < 0 || target >= preferences.favorites.length) return;
    var key = preferences.favorites.splice(index, 1)[0]; preferences.favorites.splice(target, 0, key); renderHome(key);
  }
  function navigable() { var root = controlsOpen ? $('controls-dialog') : lightsOpen ? $('lights-dialog') : exitOpen ? $('exit-dialog') : editorOpen ? $('editor') : $('screen'); return Array.from(root.querySelectorAll('.nav')).filter(function (b) { return !b.disabled && !b.closest('[hidden]') && b.getClientRects().length && !b.closest('[inert]'); }); }
  function navigationLayout() {
    if (navigationCache) return navigationCache;
    var bounds = new Map();
    navigationCache = navigable().map(function (element) {
      var rect = element.getBoundingClientRect(), scroller = element.closest('.choices, .apps-grid, .lighting-rooms, .control-devices');
      if (scroller && !bounds.has(scroller)) bounds.set(scroller, scroller.getBoundingClientRect());
      return { element: element, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
        height: rect.height, top: rect.top, bottom: rect.bottom, scroller: scroller, bounds: bounds.get(scroller),
        group: element.closest('.apps-grid, .choices, .inputs-grid, .utility-dock, .editor-tabs, .editor-footer, .editor-heading, .exit-actions, .lighting-toolbar, .lighting-rooms, .control-devices, .lighting-footer') };
    });
    return navigationCache;
  }
  function navigate(code) {
    var all = navigationLayout(), current = document.activeElement;
    var a = all.filter(function (item) { return item.element === current; })[0];
    if (!a) { if (all.length) all[0].element.focus({ preventScroll: true }); return; }
    var vertical = code === 38 || code === 40, direction = code === 37 || code === 38 ? -1 : 1;
    if (vertical && navigationX === null) navigationX = a.x;
    if (!vertical) navigationX = null;
    var pool = all.filter(function (item) { return item.group === a.group && item !== a; });
    if (vertical) {
      var nextRows = pool.filter(function (item) { return (item.y - a.y) * direction > 10; });
      if (!nextRows.length) {
        // Follow logical sections even when an overflowing row is clipped and
        // its unscrolled coordinates overlap the inputs or editor footer.
        var groups = [];
        all.forEach(function (item) { if (groups.indexOf(item.group) === -1) groups.push(item.group); });
        var nextGroup = groups[groups.indexOf(a.group) + direction];
        if (!nextGroup) return;
        nextRows = all.filter(function (item) { return item.group === nextGroup; });
      }
      var rowY = nextRows.reduce(function (value, item) { return direction > 0 ? Math.min(value, item.y) : Math.max(value, item.y); }, direction > 0 ? Infinity : -Infinity);
      pool = nextRows.filter(function (item) { return Math.abs(item.y - rowY) < 12; });
    } else {
      pool = pool.filter(function (item) { return (item.x - a.x) * direction > 10 && Math.abs(item.y - a.y) < Math.min(a.height, item.height) * .45; });
    }
    var best = null, bestScore = Infinity;
    pool.forEach(function (item) {
      var score = vertical ? Math.abs(item.x - navigationX) : Math.abs(item.x - a.x);
      if (score < bestScore) { best = item; bestScore = score; }
    });
    if (best) {
      best.element.focus({ preventScroll: true });
      if (best.scroller && (best.top < best.bounds.top + 5 || best.bottom > best.bounds.bottom - 5)) {
        best.element.scrollIntoView({ block: 'nearest', inline: 'nearest' }); invalidateNavigation();
      }
    }
  }
  document.addEventListener('keydown', function (event) {
    keyboardNavigation = true;
    var code = event.keyCode;
    var range = document.activeElement;
    if ((lightsOpen || controlsOpen) && range && range.matches('input.light-range') && !range.disabled && (code === 37 || code === 39)) {
      event.preventDefault(); var step = Number(range.dataset.keyStep || range.step) || 1;
      range.value = Math.max(Number(range.min), Math.min(Number(range.max), Number(range.value) + (code === 39 ? step : -step)));
      range.dispatchEvent(new Event('input', { bubbles: true })); return;
    }
    if ([37, 38, 39, 40].indexOf(code) !== -1) { event.preventDefault(); if (editorOpen) { window.QUIET_SETTINGS_NAV.move(code, function (key) { selectSettings(key, true); }); return; } clearHold(); if (moving) moveFavorite(code); else navigate(code); return; }
    if (code === 13) { event.preventDefault(); if (!event.repeat) startHold(document.activeElement); return; }
    if (code === 461 || code === 27 || code === 8) {
      event.preventDefault();
      if (controlsOpen) closeControls(); else if (lightsOpen) closeLights(); else if (exitOpen) closeExit(); else if (editorOpen && appearancePhotos) { appearancePhotos = false; renderChoices(); focusSetting('[data-choice=photos]'); } else if (editorOpen) closeEditor(); else if (moving) finishMove(false); else openExit();
      return;
    }
    if (code === 9) {
      var all = navigable(), i = all.indexOf(document.activeElement); event.preventDefault(); if (all.length) all[(i + (event.shiftKey ? -1 : 1) + all.length) % all.length].focus();
    }
  });
  document.addEventListener('keyup', function (event) {
    if (controlsOpen && (event.keyCode === 37 || event.keyCode === 39) && document.activeElement.matches('input.light-range')) window.QUIET_CONTROLS.flush();
    if (lightsOpen && (event.keyCode === 37 || event.keyCode === 39) && document.activeElement.matches('input.light-range')) window.QUIET_LIGHTS.flush();
    if (event.keyCode !== 13) return; event.preventDefault(); clearHold();
    if (held) { held = false; return; }
    if (moving) { finishMove(true); return; }
    var b = document.activeElement; if (b && b.tagName === 'BUTTON') b.click();
  });
  window.addEventListener('blur', clearHold);
  document.addEventListener('scroll', invalidateNavigation, true);
  document.addEventListener('pointerdown', function () { keyboardNavigation = false; navigationX = null; });
  function focusHoveredTile(event) {
    if (event.type === 'pointermove' || event.type === 'mousemove') {
      if (event.clientX === pointerX && event.clientY === pointerY) return;
      pointerX = event.clientX; pointerY = event.clientY; keyboardNavigation = false;
    } else if (keyboardNavigation) return;
    if (event.pointerType === 'touch' || moving) return;
    var button = event.target.closest && event.target.closest('.nav');
    var root = controlsOpen ? $('controls-dialog') : lightsOpen ? $('lights-dialog') : exitOpen ? $('exit-dialog') : editorOpen ? $('editor') : $('screen');
    if (!button || !root.contains(button) || button.closest('[hidden], [inert]') || button.disabled) return;
    if (event.relatedTarget && button.contains(event.relatedTarget)) return;
    if (document.activeElement !== button) { navigationX = null; button.focus({ preventScroll: true }); }
  }
  document.addEventListener('pointerover', focusHoveredTile);
  document.addEventListener('mouseover', focusHoveredTile);
  document.addEventListener('pointermove', focusHoveredTile);
  document.addEventListener('mousemove', focusHoveredTile);
  document.addEventListener('visibilitychange', function () { clearHold(); if (moving) finishMove(false); if (!document.hidden) { restoreFocus(); clock(); } });
  function restoreFocus() {
    if (controlsOpen || lightsOpen || editorOpen || exitOpen || (document.activeElement && document.activeElement.classList.contains('nav'))) return;
    var first = $('apps').querySelector('button') || $('inputs').querySelector('button') || $('edit-home');
    first.focus();
  }
  window.addEventListener('focus', restoreFocus);
  $('edit-home').innerHTML = icons.edit + '<span>Settings</span>'; $('close-editor').innerHTML = icons.close;
  $('edit-home').addEventListener('click', openEditor); $('choose-first').addEventListener('click', openEditor);
  $('close-editor').addEventListener('click', closeEditor); $('done').addEventListener('click', closeEditor); $('backdrop').addEventListener('click', function () { if (controlsOpen) closeControls(); else if (lightsOpen) closeLights(); else if (exitOpen) closeExit(); else closeEditor(); });
  $('controls-open').addEventListener('click', openControls); $('controls-close').addEventListener('click', closeControls); $('controls-done').addEventListener('click', closeControls);
  $('lights-open').addEventListener('click', openLights); $('lights-close').addEventListener('click', closeLights); $('lights-done').addEventListener('click', closeLights);
  Object.keys(settingsPages).forEach(function (key) { $(key + '-tab').addEventListener('click', function () { selectSettings(key); }); });
  $('settings-back').addEventListener('click', function () { appearancePhotos = false; renderChoices(); focusSetting('[data-choice=photos]'); });
  $('scene-button').addEventListener('click', function () {
    if ($('scene-button').getAttribute('aria-busy') === 'true') return;
    $('scene-button').setAttribute('aria-busy', 'true');
    window.QUIET_SCENES.activate().then(function (result) { if (result.requested) toast(result.title + ' requested.'); }).catch(function (error) { toast(error.message); }).finally(function () { $('scene-button').removeAttribute('aria-busy'); });
  });
  $('restore-lg').addEventListener('click', returnToLG);
  $('lg-home-tile').addEventListener('click', returnToLG);
  $('cancel-exit').addEventListener('click', closeExit); $('confirm-exit').addEventListener('click', returnToLG);
  function remoteLaunch(event) {
    var params = event.detail || {}; if (typeof params === 'string') { try { params = JSON.parse(params); } catch (e) { return; } }
    if (window.QUIET_SCENERY) window.QUIET_SCENERY.wake();
    if (settingsPages[params.settings]) { if (!editorOpen) openEditor(); selectSettings(params.settings); $(params.settings + '-tab').focus({ preventScroll: true }); return; }
    if (['lights', 'controls', 'scene', 'scenery', 'settings'].indexOf(params.action) < 0) return;
    if (controlsOpen) closeControls(); if (lightsOpen) closeLights(); if (exitOpen) closeExit(); if (editorOpen) closeEditor();
    if (params.action === 'lights') openLights();
    if (params.action === 'controls') openControls();
    if (params.action === 'settings') openEditor();
    if (params.action === 'scene') $('scene-button').click();
    if (params.action === 'scenery') window.QUIET_SCENERY.enter();
  }
  document.addEventListener('webOSLaunch', remoteLaunch); document.addEventListener('webOSRelaunch', remoteLaunch);
  function fit() { invalidateNavigation(); $('screen').style.setProperty('--scale', Math.min(window.innerWidth / 1920, window.innerHeight / 1080)); if (window.QUIET_GLASS) window.QUIET_GLASS.refresh(); }
  function clock() { var now = new Date(); $('clock').textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(now); $('clock').dateTime = now.toISOString(); $('date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now); }
  window.addEventListener('resize', fit); fit(); clock(); setInterval(clock, 30000);
  renderHome(); updateSceneButton(); var first = $('apps').querySelector('button') || $('inputs').querySelector('button') || $('edit-home'); first.focus();
  var previewSettings = new URLSearchParams(window.location.search).get('settings');
  if (previewSettings && settingsPages[previewSettings]) remoteLaunch({ detail: { settings: previewSettings } });
  document.fonts.ready.then(function () { invalidateNavigation(); if (window.QUIET_GLASS) window.QUIET_GLASS.refresh(); });
})();
