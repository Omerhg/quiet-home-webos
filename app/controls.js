(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var endpoint = (window.QUIET_CONTROLS_CONFIG || {}).endpoint;
  var active = false, connected = false, reading = false, poll, reader, devices = [], refs = {}, drafts = {}, queued = {};
  var writes = Promise.resolve(), layoutChanged = function () {};
  function el(tag, name, text) { var node = document.createElement(tag); if (name) node.className = name; if (text !== undefined) node.textContent = text; return node; }
  function status(text, error) { $('controls-status').textContent = text; $('controls-status').classList.toggle('error', !!error); }
  function request(payload, controller) {
    if (!/^https?:\/\/[^\s/@?#]+\/api\/quiet_home_controls\/[A-Za-z0-9_-]{32,}$/.test(endpoint || '')) return Promise.reject(new Error('Not configured'));
    controller = controller || new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 6000);
    var options = { signal: controller.signal, credentials: 'omit', cache: 'no-store' };
    if (payload) { options.method = 'POST'; options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify(payload); }
    return fetch(endpoint, options).then(function (r) { if (!r.ok) throw new Error('Unavailable'); return r.json(); }).then(function (data) {
      if (!Array.isArray(data.devices)) throw new Error('Invalid status'); return data;
    }).finally(function () { clearTimeout(timeout); });
  }
  function value(device, action) { var draft = drafts[device.id + '/' + action]; return draft ? draft.value : device[action]; }
  function patch() {
    devices.forEach(function (device) {
      Object.keys(drafts).forEach(function (key) { var draft = drafts[key]; if (draft.id === device.id && (device[draft.action === 'power' ? 'on' : draft.action] === draft.value || Date.now() >= draft.until)) delete drafts[key]; });
      var ref = refs[device.id]; if (!ref) return;
      var pending = Object.keys(drafts).some(function (key) { return drafts[key].id === device.id; });
      ref.card.classList.toggle('light-offline', !device.available); ref.card.setAttribute('aria-busy', String(pending));
      ref.note.textContent = !device.available ? 'Unavailable' : pending ? 'Updating…' : device.kind === 'fan' ? (device.on ? (device.preset || 'On') : 'Off') : device.kind === 'cover' ? (device.state === 'opening' ? 'Opening…' : device.state === 'closing' ? 'Closing…' : (device.position == null ? device.state : device.position + '% open')) : (device.mute ? 'Muted' : 'Volume');
      ref.controls.forEach(function (control) { control.disabled = !connected || !device.available; });
      if (ref.power) { var p = drafts[device.id + '/power']; ref.power.setAttribute('aria-checked', String(p ? p.value : device.on)); }
      if (ref.mute) ref.mute.setAttribute('aria-pressed', String(!!value(device, 'mute')));
      ['speed', 'position', 'volume'].forEach(function (action) {
        if (!ref[action]) return;
        var current = value(device, action); if (current == null) current = 0;
        ref[action].value = current; ref[action].style.setProperty('--range-progress', current + '%');
        ref[action].setAttribute('aria-valuetext', current + (action === 'position' ? ' percent open' : ' percent'));
        ref[action + 'Output'].textContent = current + '%';
      });
      ref.presets.forEach(function (button) { button.setAttribute('aria-pressed', String(value(device, 'preset') === button.dataset.preset)); });
    }); layoutChanged();
  }
  function update(data) { devices = data.devices; if (!Object.keys(refs).length) render(); patch(); }
  function send(payload) {
    writes = writes.catch(function () {}).then(function () { return request(payload); }).then(function (data) {
      connected = true; if (active) { update(data); status('Connected · Changes apply immediately'); }
    }).catch(function () {
      delete drafts[payload.id + '/' + payload.action];
      if (active) { status('Could not update the device. Try Refresh.', true); patch(); }
    });
  }
  function flush(key) { if (!queued[key]) return; var item = queued[key]; clearTimeout(item.timer); delete queued[key]; send(item.payload); }
  function queue(device, action, next) {
    if (!active || !connected || !device.available) return;
    if (device.kind === 'cover' && ['open', 'close', 'stop'].indexOf(action) >= 0) {
      var positionKey = device.id + '/position';
      if (queued[positionKey]) { clearTimeout(queued[positionKey].timer); delete queued[positionKey]; }
      delete drafts[positionKey];
    }
    var key = device.id + '/' + action;
    drafts[key] = { id: device.id, action: action, value: next, until: Date.now() + 6000 };
    if (queued[key]) queued[key].payload.value = next;
    else queued[key] = { payload: { id: device.id, action: action, value: next }, timer: setTimeout(function () { flush(key); }, ['speed', 'position', 'volume'].indexOf(action) < 0 ? 0 : 180) };
    patch();
  }
  function button(device, ref, text, action, next) {
    var b = el('button', 'nav light-room-action', text); b.setAttribute('aria-label', device.name + ' ' + text);
    b.addEventListener('click', function () { var live = devices.filter(function (d) { return d.id === device.id; })[0]; queue(live, action, typeof next === 'function' ? next(live) : next); });
    ref.controls.push(b); return b;
  }
  function range(device, ref, action, title) {
    var line = el('div', 'light-level-label'); line.appendChild(el('span', '', title)); var output = el('output'); line.appendChild(output); ref.card.appendChild(line);
    var input = el('input', 'nav light-range'); input.type = 'range'; input.min = 0; input.max = 100; input.step = 1; input.dataset.keyStep = '5'; input.value = device[action] || 0;
    input.setAttribute('aria-label', device.name + ' ' + title.toLowerCase());
    input.addEventListener('input', function () { queue(devices.filter(function (d) { return d.id === device.id; })[0], action, Number(input.value)); });
    input.addEventListener('change', function () { flush(device.id + '/' + action); });
    ref.card.appendChild(input); ref[action] = input; ref[action + 'Output'] = output; ref.controls.push(input);
  }
  function render() {
    var host = $('control-devices'); host.replaceChildren(); refs = {};
    devices.forEach(function (device) {
      var card = el('section', 'light-card'), heading = el('div', 'light-card-heading'), copy = el('div'); card.dataset.device = device.id;
      copy.appendChild(el('span', 'control-room', device.room)); copy.appendChild(el('h4', '', device.name)); var note = el('span', 'light-state'); copy.appendChild(note); heading.appendChild(copy); card.appendChild(heading);
      var ref = { card: card, note: note, controls: [], presets: [] }; refs[device.id] = ref;
      if (device.actions.indexOf('power') >= 0) {
        var power = button(device, ref, 'power', 'power', function (live) { var draft = drafts[live.id + '/power']; return !(draft ? draft.value : live.on); });
        power.className = 'nav light-power'; power.textContent = ''; power.setAttribute('role', 'switch'); power.appendChild(el('span', 'light-toggle-thumb')); heading.appendChild(power); ref.power = power;
      }
      ['speed', 'position', 'volume'].forEach(function (action) { if (device.actions.indexOf(action) >= 0) range(device, ref, action, { speed: 'Fan speed', position: 'Open position', volume: 'Volume' }[action]); });
      var actions = el('div', 'control-actions');
      if (device.actions.indexOf('preset') >= 0) device.presets.forEach(function (preset) { var b = button(device, ref, preset.charAt(0).toUpperCase() + preset.slice(1), 'preset', preset); b.dataset.preset = preset; ref.presets.push(b); actions.appendChild(b); });
      ['open', 'stop', 'close'].forEach(function (action) { if (device.actions.indexOf(action) >= 0) actions.appendChild(button(device, ref, action.charAt(0).toUpperCase() + action.slice(1), action, null)); });
      if (device.actions.indexOf('mute') >= 0) { ref.mute = button(device, ref, 'Mute', 'mute', function (live) { return !value(live, 'mute'); }); actions.appendChild(ref.mute); }
      if (actions.children.length) card.appendChild(actions);
      host.appendChild(card);
    }); layoutChanged();
  }
  function schedule() { clearTimeout(poll); if (active && !document.hidden) poll = setTimeout(refresh, 2000); }
  function refresh() {
    if (!active || document.hidden || reading) return;
    clearTimeout(poll); reading = true; reader = new AbortController();
    request(null, reader).then(function (data) { if (active) { connected = true; update(data); status('Connected · Changes apply immediately'); } }).catch(function () {
      if (active) { connected = false; patch(); status('Home Assistant is unavailable. Try Refresh.', true); }
    }).finally(function () { reading = false; reader = null; schedule(); });
  }
  window.QUIET_CONTROLS = {
    open: function (callback) { active = true; connected = false; layoutChanged = callback; status('Connecting…'); patch(); refresh(); },
    close: function () { Object.keys(queued).forEach(flush); active = false; clearTimeout(poll); if (reader) reader.abort(); },
    flush: function () { Object.keys(queued).forEach(flush); }
  };
  $('controls-refresh').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { clearTimeout(poll); if (reader) reader.abort(); } else refresh(); });
})();
