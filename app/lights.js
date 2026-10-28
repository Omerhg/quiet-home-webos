(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var endpoint = (window.QUIET_LIGHTS_CONFIG || {}).endpoint;
  var active = false, connected = false, reading = false, poll = null, readController = null;
  var expandedId = null;
  var lights = [], refs = {}, drafts = {}, queued = {}, layoutChanged = function () {}, writes = Promise.resolve();
  function element(tag, className, text) {
    var node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  }
  function status(text, error) { $('lights-status').textContent = text; $('lights-status').classList.toggle('error', !!error); }
  function request(payload, controller) {
    if (!/^https?:\/\/[^\s/@?#]+\/api\/quiet_home_lights\/[A-Za-z0-9_-]{32,}$/.test(endpoint || '')) return Promise.reject(new Error('Lighting connection is not configured.'));
    controller = controller || new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 6000);
    var options = { credentials: 'omit', cache: 'no-store', signal: controller.signal };
    if (payload) { options.method = 'POST'; options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify(payload); }
    return fetch(endpoint, options).then(function (response) {
      if (!response.ok) throw new Error('Home Assistant could not update the light.');
      return response.json();
    }).then(function (data) {
      if (!Array.isArray(data.lights)) throw new Error('Lighting status is unavailable.');
      return data;
    }).finally(function () { clearTimeout(timer); });
  }
  function matches(light, action, value) {
    if (action === 'power') return light.on === value;
    if (action === 'brightness') return value === 0 ? !light.on : light.on && Math.abs((light.brightness || 0) - value) <= 1;
    if (action === 'kelvin') return light.on && light.kelvin && Math.abs(light.kelvin - value) < 100;
    return light.on && Array.isArray(light.rgb) && light.rgb.every(function (n, i) { return Math.abs(n - value[i]) < 18; });
  }
  function update(data) {
    lights = data.lights;
    if (!Object.keys(refs).length) render();
    lights.forEach(function (light) {
      Object.keys(drafts).forEach(function (key) {
        var draft = drafts[key];
        if (draft.id === light.id && (matches(light, draft.action, draft.value) || Date.now() > draft.until)) delete drafts[key];
      });
      var ref = refs[light.id]; if (!ref) return;
      var usable = connected && light.available;
      var pending = Object.keys(drafts).some(function (key) { return drafts[key].id === light.id; });
      ref.card.classList.toggle('light-offline', !light.available);
      ref.power.setAttribute('aria-checked', String(light.on));
      ref.note.textContent = !light.available ? 'Unavailable' : pending ? 'Updating…' : light.on ? (light.dimmable && light.brightness != null ? light.brightness + '%' : 'On') : 'Off';
      ref.controls.forEach(function (control) { control.disabled = !usable; });
      ref.card.setAttribute('aria-busy', String(pending));
      ['brightness', 'kelvin'].forEach(function (action) {
        var input = ref[action]; if (!input) return;
        var draft = drafts[light.id + '/' + action], value = draft ? draft.value : action === 'brightness' && !light.on ? 0 : light[action];
        if (value !== null && value !== undefined) input.value = value;
        input.style.setProperty('--range-progress', ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100) + '%');
        ref[action + 'Output'].textContent = action === 'brightness' ? (value === null || value === undefined ? '—' : value + '%') : value ? value + ' K' : 'Color';
        input.setAttribute('aria-valuetext', action === 'brightness' ? input.value + ' percent' : input.value + ' kelvin');
      });
    });
    document.querySelectorAll('.light-room-action').forEach(function (button) {
      button.disabled = !connected || !lights.some(function (light) { return light.room === button.dataset.room && light.available; });
    });
    layoutChanged();
  }
  function send(payload) {
    writes = writes.catch(function () {}).then(function () { return request(payload); }).then(function (data) {
      connected = true;
      if (active) { update(data); status(data.unavailable && data.unavailable.length ? 'Some lights are unavailable.' : 'Connected · Changes apply immediately'); }
      if (active) setTimeout(function () { if (active) refresh(); }, 350);
    }).catch(function () {
      payload.ids.forEach(function (id) { delete drafts[id + '/' + payload.action]; });
      if (active) { status('Could not reach Home Assistant. Try Refresh.', true); update({ lights: lights }); }
    });
  }
  function flush(key) {
    if (!queued[key]) return;
    var item = queued[key]; clearTimeout(item.timer); delete queued[key];
    send({ ids: [item.id], action: item.action, value: item.value });
  }
  function queue(light, action, value) {
    if (!connected || !light.available) return;
    var key = light.id + '/' + action;
    drafts[key] = { id: light.id, action: action, value: value, until: Date.now() + 6000 };
    if (queued[key]) queued[key].value = value;
    else queued[key] = { id: light.id, action: action, value: value, timer: setTimeout(function () { flush(key); }, action === 'power' || action === 'color' ? 0 : 180) };
    refs[light.id].note.textContent = 'Updating…'; refs[light.id].card.setAttribute('aria-busy', 'true');
  }
  function button(text, label, className, action) {
    var b = element('button', 'nav ' + className, text); b.setAttribute('aria-label', label); b.addEventListener('click', action); return b;
  }
  function range(light, ref, action, title, min, max, step, initial) {
    var line = element('div', 'light-level-label'); line.appendChild(element('span', '', title));
    var output = element('output'); line.appendChild(output); ref.body.appendChild(line);
    var input = element('input', 'nav light-range'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = initial;
    input.setAttribute('aria-label', light.name + ' ' + title.toLowerCase()); input.dataset.lightAction = action;
    input.style.setProperty('--range-progress', ((Number(input.value) - min) / (max - min) * 100) + '%');
    input.addEventListener('input', function () {
      var value = Number(input.value); input.style.setProperty('--range-progress', ((value - min) / (max - min) * 100) + '%'); output.textContent = action === 'brightness' ? value + '%' : value + ' K';
      input.setAttribute('aria-valuetext', action === 'brightness' ? value + ' percent' : value + ' kelvin');
      queue(light, action, value);
    });
    input.addEventListener('change', function () { flush(light.id + '/' + action); });
    ref.body.appendChild(input); ref[action] = input; ref[action + 'Output'] = output; ref.controls.push(input);
  }
  function expand(id, restoreFocus) {
    expandedId = id;
    Object.keys(refs).forEach(function (key) {
      var ref = refs[key], open = key === id; ref.body.hidden = !open; ref.card.classList.toggle('is-expanded', open);
      if (ref.disclosure) ref.disclosure.setAttribute('aria-expanded', String(open));
    }); layoutChanged();
    if (restoreFocus && refs[restoreFocus] && refs[restoreFocus].disclosure) refs[restoreFocus].disclosure.focus({ preventScroll: true });
  }
  function render() {
    $('lighting-rooms').replaceChildren(); refs = {};
    ['Living room', 'Kitchen'].forEach(function (room) {
      var section = element('section', 'lighting-room'); section.setAttribute('aria-label', room);
      var heading = element('div', 'light-room-heading'); heading.appendChild(element('h3', '', room));
      var actions = element('div', 'light-room-actions');
      [true, false].forEach(function (on) {
        var b = button(on ? 'All on' : 'All off', room + (on ? ' all on' : ' all off'), 'light-room-action', function () {
          var ids = lights.filter(function (light) { return light.room === room && light.available; }).map(function (light) { return light.id; });
          if (ids.length) send({ ids: ids, action: 'power', value: on });
        }); b.dataset.room = room; actions.appendChild(b);
      });
      heading.appendChild(actions); section.appendChild(heading);
      lights.filter(function (light) { return light.room === room; }).forEach(function (light, index) {
        var card = element('div', 'light-card compact-device'), body = element('div', 'device-details'), title = element('div', 'light-card-heading');
        card.dataset.light = light.id; body.hidden = true; body.id = 'light-details-' + room.replace(/ /g, '-') + '-' + index;
        var hasDetails = light.dimmable || light.warmth || light.color;
        var disclosure = element(hasDetails ? 'button' : 'div', hasDetails ? 'nav device-disclosure' : 'device-summary-static');
        var glyph = element('span', 'device-glyph'); glyph.setAttribute('aria-hidden', 'true'); glyph.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 16c0-3-3-4-3-8a7 7 0 0 1 14 0c0 4-3 5-3 8M8 16h8M9 19h6M10 22h4"/></svg>';
        var copy = element('span', 'device-copy'); copy.appendChild(element('span', 'device-name', light.name)); var note = element('span', 'light-state'); copy.appendChild(note); disclosure.append(glyph, copy);
        if (hasDetails) {
          disclosure.setAttribute('aria-label', light.name + ' details'); disclosure.setAttribute('aria-expanded', 'false'); disclosure.setAttribute('aria-controls', body.id);
          var chevron = element('span', 'device-chevron'); chevron.setAttribute('aria-hidden', 'true'); disclosure.appendChild(chevron);
          disclosure.addEventListener('click', function () { expand(expandedId === light.id ? null : light.id); });
        }
        var power = button('', light.name + ' power', 'light-power', function () {
          var live = lights.filter(function (item) { return item.id === light.id; })[0];
          var pending = drafts[light.id + '/power']; queue(live, 'power', !(pending ? pending.value : live.on));
        });
        power.setAttribute('role', 'switch'); power.setAttribute('aria-checked', String(light.on));
        var thumb = element('span', 'light-toggle-thumb'); thumb.setAttribute('aria-hidden', 'true'); power.appendChild(thumb);
        title.append(disclosure, power); card.append(title, body);
        var ref = { card: card, body: body, disclosure: hasDetails ? disclosure : null, power: power, note: note, controls: [power] }; refs[light.id] = ref;
        if (light.dimmable) range(light, ref, 'brightness', 'Brightness', 0, 100, 5, light.brightness || 50);
        if (light.warmth) range(light, ref, 'kelvin', 'White warmth', light.min_kelvin, light.max_kelvin, 100, light.kelvin || 2700);
        if (light.color) {
          var colors = element('div', 'light-colors');
          [
            { title: 'Warm white', color: '#ffe4b4', action: 'kelvin', value: 2700 },
            { title: 'Amber', color: '#ff9b52', action: 'color', value: [255, 135, 50] },
            { title: 'Blue', color: '#7aa8ff', action: 'color', value: [70, 130, 255] },
            { title: 'Purple', color: '#c390ff', action: 'color', value: [170, 75, 255] },
            { title: 'Green', color: '#79e1b0', action: 'color', value: [65, 225, 140] }
          ].forEach(function (preset) {
            var b = button('', light.name + ' ' + preset.title, 'light-color', function () { queue(light, preset.action, preset.value); });
            b.style.setProperty('--swatch', preset.color); b.title = preset.title; colors.appendChild(b); ref.controls.push(b);
          }); body.appendChild(colors);
        }
        section.appendChild(card);
      }); $('lighting-rooms').appendChild(section);
    }); layoutChanged();
  }
  function schedule() { clearTimeout(poll); if (active && !document.hidden) poll = setTimeout(refresh, 2000); }
  function refresh() {
    if (!active || document.hidden || reading) return;
    clearTimeout(poll); reading = true; readController = new AbortController(); $('lights-refresh').setAttribute('aria-busy', 'true');
    request(null, readController).then(function (data) {
      if (!active) return; connected = true; update(data); status('Connected · Changes apply immediately');
    }).catch(function () {
      if (!active) return; connected = false; status('Home Assistant is unavailable. Try Refresh.', true); update({ lights: lights });
    }).finally(function () { reading = false; readController = null; $('lights-refresh').removeAttribute('aria-busy'); schedule(); });
  }
  window.QUIET_LIGHTS = {
    open: function (onLayout) { expand(null); active = true; connected = false; layoutChanged = onLayout; status('Connecting…'); if (lights.length) update({ lights: lights }); refresh(); },
    close: function () { expand(null); Object.keys(queued).forEach(flush); active = false; clearTimeout(poll); if (readController) readController.abort(); },
    back: function () { if (!expandedId) return false; var previous = expandedId; expand(null, previous); return true; },
    refresh: refresh,
    flush: function () { Object.keys(queued).forEach(flush); }
  };
  $('lights-refresh').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { clearTimeout(poll); if (readController) readController.abort(); } else refresh(); });
})();
