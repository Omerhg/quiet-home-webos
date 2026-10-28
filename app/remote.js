(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, policy = window.QUIET_REMOTE_POLICY;
  var group = new URLSearchParams(location.search).get('group') === 'features' ? 'features' : 'apps';
  var snapshot = {settings:{},configs:{}}, buttons = [], selected = null, pending = null, type = 'app', busy = false, loaded = false, bridges = [];
  var keyboardNavigation = false, pointerX = null, pointerY = null;
  var STORAGE = 'quiet-home.remote.originals.v1', originals = {};
  try { originals = JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch (e) {}
  var apps = (window.HOME_CATALOG || {apps:[],inputs:[]}).apps.map(function (a) { return {type:'app',id:a.id,params:a.params || {},title:a.title,icon:a.icon}; });
  var inputs = (window.HOME_CATALOG || {inputs:[]}).inputs.map(function (a) { return {type:'input',id:a.id,params:a.params || {},title:a.title}; });
  var features = [
    {type:'feature',id:'com.quiet.mute',params:{},title:'Mute / unmute'},
    {type:'feature',id:'com.quiet.home',params:{action:'lights'},title:'Lights'},
    {type:'feature',id:'com.quiet.home',params:{action:'controls'},title:'Home controls'},
    {type:'feature',id:'com.quiet.home',params:{action:'scene'},title:'Activate Home scene'},
    {type:'feature',id:'com.quiet.home',params:{action:'scenery'},title:'Scenery mode'},
    {type:'feature',id:'com.quiet.home',params:{action:'settings'},title:'Home settings'},
    {type:'feature',id:'com.quiet.home',params:{},title:'Quiet Home'},
    {type:'feature',id:'com.webos.app.home',params:{},title:'LG Home'},
    {type:'feature',id:'com.webos.app.quickinputpicker',params:{},title:'Input picker'}
  ];
  var targets = apps.concat(inputs, features);
  function status(text, error) { $('remote-status').textContent = text; $('remote-status').classList.toggle('error', !!error); }
  function call(uri, params) {
    if (typeof PalmServiceBridge === 'undefined') return Promise.reject(new Error('Open this editor on your TV to read or change buttons.'));
    return new Promise(function (resolve,reject) {
      var bridge = new PalmServiceBridge(), done = false; bridges.push(bridge);
      function finish(result) { if (done) return; done = true; clearTimeout(timer); var i = bridges.indexOf(bridge); if (i >= 0) bridges.splice(i,1); if (result && result.returnValue) resolve(result); else reject(new Error('The TV did not allow this operation.')); }
      var timer = setTimeout(function () { if (bridge.cancel) bridge.cancel(); finish({returnValue:false}); },6000);
      bridge.onservicecallback = function (text) { try { finish(JSON.parse(text)); } catch (e) { finish({returnValue:false}); } };
      try { bridge.call('luna://' + uri, JSON.stringify(params)); } catch (e) { finish({returnValue:false}); }
    });
  }
  function read() {
    var result = {settings:{},configs:{}}, failures = 0;
    return Promise.all([
      call('com.webos.settingsservice/getSystemSettings',{category:'other',keys:['mapping_info']}).then(function (r) { if (Array.isArray((r.settings || {}).mapping_info)) result.settings.mapping_info = r.settings.mapping_info; }).catch(function () { failures++; }),
      call('com.webos.settingsservice/getSystemSettings',{category:'other',keys:['customShortPress','customLongPress']}).then(function (r) { Object.assign(result.settings,r.settings || {}); }).catch(function () { failures++; }),
      call('com.webos.service.config/getConfigs',{configNames:['com.webos.keyaction.tvGuide','com.webos.keyaction.inputHub']}).then(function (r) { result.configs = r.configs || {}; }).catch(function () { failures++; })
    ]).then(function () { if (failures === 3 || !policy.buttons(result).length) throw new Error('Could not read remote assignments. Try again on the TV.'); return result; });
  }
  function currentTarget(button) {
    var value = policy.entry(snapshot,button) || {}, id = button.kind === 'mapping' ? value.app_id : value.id;
    var params = button.kind === 'mapping' ? value.launch_param : value.params;
    if (typeof params === 'string') { try { params = JSON.parse(params); } catch (e) { params = {}; } }
    params = params && typeof params === 'object' ? params : {};
    return targets.filter(function (target) { return target.id === id && policy.same(target.params,params); })[0] || {title:id || 'LG original'};
  }
  function storageKey(button) { return button.kind + '/' + button.key; }
  function original(button) { return (window.QUIET_REMOTE_ORIGINALS || {})[button.key] || originals[storageKey(button)]; }
  function ensureOriginal(button) {
    var key = storageKey(button); if (!originals[key]) originals[key] = original(button) || policy.entry(snapshot,button);
    try { localStorage.setItem(STORAGE,JSON.stringify(originals)); if (!localStorage.getItem(STORAGE)) throw new Error('No storage'); }
    catch (e) { throw new Error('Could not save the original assignment. No change was made.'); }
  }
  function selectButton(button, focusTarget) {
    selected = button; pending = null; type = group === 'apps' ? 'app' : 'feature';
    $('remote-button-title').textContent = button.name; $('remote-current').textContent = 'Current: ' + currentTarget(button).title;
    document.querySelectorAll('#remote-keys button').forEach(function (b) { b.setAttribute('aria-pressed',String(b.dataset.key === button.key)); });
    $('remote-target-tabs').hidden = group === 'apps';
    $('remote-restore').disabled = !original(button); $('remote-save').disabled = true; renderTargets();
    if (focusTarget) { var first = $('remote-targets').querySelector('button'); if (first) first.focus({preventScroll:true}); }
  }
  function renderTargets() {
    $('remote-targets').replaceChildren(); $('remote-targets').scrollTop = 0;
    document.querySelectorAll('[data-type]').forEach(function (b) { b.setAttribute('aria-selected',String(b.dataset.type === type)); });
    targets.filter(function (target) { return target.type === type; }).forEach(function (target) {
      var button = document.createElement('button'); button.className = 'nav'; button.setAttribute('aria-label',target.title);
      button.setAttribute('aria-pressed',String(pending ? policy.same(pending,target) : currentTarget(selected) === target));
      if (target.icon) { var image = document.createElement('img'); image.src = target.icon; image.alt = ''; button.appendChild(image); }
      var label = document.createElement('span'); label.textContent = target.title; button.appendChild(label);
      button.addEventListener('click',function () { if (busy) return; pending = target; document.querySelectorAll('#remote-targets button').forEach(function (b) { b.setAttribute('aria-pressed',String(b === button)); }); $('remote-save').disabled = false; });
      $('remote-targets').appendChild(button);
    });
  }
  function renderKeys() {
    $('remote-keys').replaceChildren(); var available = buttons.filter(function (b) { return b.group === group; });
    available.forEach(function (button) {
      var node = document.createElement('button'); node.className = 'nav'; node.textContent = button.name; node.dataset.key = button.key;
      node.addEventListener('click',function () { if (!busy) selectButton(button); }); $('remote-keys').appendChild(node);
    });
    var next = available.filter(function (b) { return selected && b.key === selected.key; })[0] || available[0];
    if (next) selectButton(next);
    else { selected = null; $('remote-button-title').textContent = 'No buttons available'; $('remote-current').textContent = 'The TV did not expose editable buttons in this category.'; $('remote-targets').replaceChildren(); $('remote-target-tabs').hidden = true; $('remote-save').disabled = true; $('remote-restore').disabled = true; }
  }
  function showGroup(next) {
    if (busy) return; group = next; pending = null;
    ['apps','features','system'].forEach(function (name) { $('remote-' + name).setAttribute('aria-pressed',String(name === group)); });
    $('remote-system-note').hidden = group !== 'system'; $('remote-workspace').hidden = group === 'system';
    $('remote-note').textContent = group === 'apps' ? 'Select a button that is printed on your remote. LG may reset app shortcuts after a restart or regional update; return here to reassign it. No background remapper is installed.' : group === 'features' ? 'Changes apply when you next press that button. Restore original puts back its saved LG action.' : 'System-wide reassignment of these keys needs a different, persistent input remapper. This setup keeps native LG handling.';
    if (group === 'system') { $('remote-save').disabled = true; $('remote-restore').disabled = true; } else if (loaded) renderKeys();
  }
  function loadApps() {
    return call('com.webos.applicationManager/listApps',{}).then(function (data) {
      if (!Array.isArray(data.apps)) return;
      var known = apps, installed = data.apps.filter(function (app) {
        return app && typeof app.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/.test(app.id) && typeof app.title === 'string' && app.title && app.visible !== false && ['com.quiet.home','com.quiet.mute'].indexOf(app.id) < 0;
      }).map(function (app) {
        var bundled = known.filter(function (item) { return item.id === app.id; })[0];
        return {type:'app',id:app.id,params:{},title:app.title,icon:bundled && bundled.icon};
      });
      if (installed.length) { apps = installed.sort(function (a,b) { return a.title.localeCompare(b.title); }); targets = apps.concat(inputs,features); }
    }).catch(function () { /* Keep the catalog if listing apps is unavailable. */ });
  }
  function refresh() {
    if (busy) return; status('Reading assignments from your TV…'); $('remote-retry').hidden = true;
    return Promise.all([read(),loadApps()]).then(function (results) { snapshot = results[0]; buttons = policy.buttons(snapshot); loaded = true; showGroup(group); status('Assignments read from your TV · Nothing changes until you save'); }).catch(function (e) { status(e.message,true); $('remote-retry').hidden = false; });
  }
  function save(restore) {
    if (busy || !selected || (!restore && !pending)) return;
    var button = selected, target = restore ? null : pending; busy = true;
    document.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); status(restore ? 'Restoring original…' : 'Saving assignment…');
    // Read immediately before writing so unrelated shortcut entries are preserved.
    read().then(function (data) {
      snapshot = data; ensureOriginal(button);
      var plan = policy.plan(button,target,snapshot,original(button),targets);
      return call(plan.uri,plan.params).then(function () { return read(); }).then(function (after) {
        if (!policy.same(policy.entry(after,button),plan.expected)) throw new Error('LG did not keep that assignment. Try again.');
        snapshot = after; buttons = policy.buttons(after); return restore ? button.name + ' restored to its original action.' : button.name + ' now opens ' + target.title + '.';
      });
    }).then(function (text) { busy = false; document.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); renderKeys(); status(text); }).catch(function (error) {
      busy = false; document.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); if (selected) selectButton(selected); status(error.message,true);
    });
  }
  function back() {
    if (busy) return;
    if (typeof PalmServiceBridge === 'undefined') { location.href = 'index.html?settings=remote'; return; }
    call('com.webos.applicationManager/launch',{id:'com.quiet.home',params:{settings:'remote'}}).catch(function () { status('Could not return to Settings.',true); });
  }
  ['apps','features','system'].forEach(function (name) { $('remote-' + name).addEventListener('click',function () { showGroup(name); }); });
  document.querySelectorAll('[data-type]').forEach(function (button) { button.addEventListener('click',function () { if (busy || !selected) return; type = button.dataset.type; renderTargets(); }); });
  $('remote-close').addEventListener('click',back); $('remote-back').addEventListener('click',back); $('remote-save').addEventListener('click',function () { save(false); }); $('remote-restore').addEventListener('click',function () { save(true); }); $('remote-retry').addEventListener('click',refresh);
  function focus(button) { if (button) button.focus({preventScroll:true}); }
  function visibleButtons(root) { return Array.from(root.querySelectorAll('button')).filter(function (b) { return !b.disabled && !b.closest('[hidden]'); }); }
  document.addEventListener('keydown',function (event) {
    keyboardNavigation = true;
    var code = event.keyCode, current = document.activeElement; if ([13,37,38,39,40,9,27,461,8].indexOf(code) < 0) return; event.preventDefault();
    if (code === 27 || code === 461 || code === 8) { back(); return; } if (code === 13) return;
    var all = visibleButtons(document), index = all.indexOf(current);
    if (code === 9) { focus(all[(index + (event.shiftKey ? -1 : 1) + all.length) % all.length]); return; }
    var groupRoot = current.closest('.editor-tabs, .remote-keys, .remote-targets, .remote-target-tabs, .editor-footer');
    if (code === 38 || code === 40) {
      var list = groupRoot ? visibleButtons(groupRoot) : [], i = list.indexOf(current), next = list[i + (code === 38 ? -1 : 1)];
      if (next) focus(next); else if (code === 40) focus(groupRoot && groupRoot.classList.contains('remote-target-tabs') ? $('remote-targets').querySelector('button') : visibleButtons(document.querySelector('.editor-footer'))[0]);
      else focus($('remote-close')); return;
    }
    if (groupRoot && groupRoot.classList.contains('editor-tabs') && code === 39) { if (!current.id.endsWith(group)) showGroup(current.id.replace('remote-','')); focus($('remote-keys').querySelector('button')); return; }
    if (groupRoot && groupRoot.classList.contains('remote-keys')) { if (code === 37) focus($('remote-' + group)); else { var b = buttons.filter(function (b) { return b.key === current.dataset.key; })[0]; if (b) selectButton(b,true); } return; }
    if (groupRoot && groupRoot.classList.contains('remote-targets')) { if (code === 37) focus(document.querySelector('#remote-keys button[aria-pressed="true"]')); else focus(!$('remote-save').disabled ? $('remote-save') : $('remote-restore')); return; }
    if (groupRoot) { var siblings = visibleButtons(groupRoot), at = siblings.indexOf(current); focus(siblings[at + (code === 37 ? -1 : 1)]); }
  });
  document.addEventListener('keyup',function (event) { if (event.keyCode === 13) { event.preventDefault(); if (document.activeElement.tagName === 'BUTTON' && !document.activeElement.disabled) document.activeElement.click(); } });
  document.addEventListener('focusin',function (event) {
    var pane = event.target.closest('.remote-keys,.remote-targets'); if (!pane) return;
    var scale = $('screen').getBoundingClientRect().width / 1920, a = event.target.getBoundingClientRect(), b = pane.getBoundingClientRect();
    if (a.top < b.top + 10) pane.scrollTop -= (b.top + 10 - a.top) / scale;
    else if (a.bottom > b.bottom - 10) pane.scrollTop += (a.bottom - b.bottom + 10) / scale;
  });
  function hover(event) {
    if (event.type === 'pointermove') {
      if (event.clientX === pointerX && event.clientY === pointerY) return;
      pointerX = event.clientX; pointerY = event.clientY; keyboardNavigation = false;
    } else if (keyboardNavigation) return;
    var button = event.target.closest('button'); if (button && !button.disabled && !button.closest('[hidden]')) focus(button);
  }
  document.addEventListener('pointerover',hover); document.addEventListener('pointermove',hover);
  function fit() { $('screen').style.setProperty('--scale',Math.min(innerWidth / 1920,innerHeight / 1080)); }
  window.addEventListener('resize',fit); fit(); showGroup(group); focus($('remote-' + group)); refresh();
})();
