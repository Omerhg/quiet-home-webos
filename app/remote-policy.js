(function (root) {
  'use strict';
  var labels = {netflix:'Netflix',amazon:'Prime Video',disneyplus:'Disney+',lgchannels:'LG Channels',rakutentv:'Rakuten TV',youtube:'YouTube',apps:'Apps',movies:'Movies',hulu:'Hulu',iplayer:'BBC iPlayer',freeviewplay:'Freeview Play',slingtv:'Sling TV',hotstar:'Hotstar',ivi:'IVI',globoplay:'Globoplay',okko:'Okko',kinopoisk:'Kinopoisk',watchaplay:'Watcha',unext:'U-NEXT',fptplay:'FPT Play',shahid:'Shahid',wavve:'Wavve',coupangplay:'Coupang Play',stan:'Stan',shop:'Shop',tver:'TVer',nhkplus:'NHK Plus',tod:'TOD',sonyliv:'Sony LIV',tv360:'TV360',vtvgo:'VTV Go',wink:'Wink',start:'Start',vkvideo:'VK Video',premier:'Premier',haystack:'Haystack',abema:'Abema'};
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function canonical(value) { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'; return '{' + Object.keys(value).sort().map(function (k) { return JSON.stringify(k) + ':' + canonical(value[k]); }).join(',') + '}'; }
  function entry(snapshot, button) {
    if (button.kind === 'mapping') { var row = (snapshot.settings.mapping_info || []).filter(function (item) { return Object.prototype.hasOwnProperty.call(item, button.key); })[0]; return row && row[button.key]; }
    return button.kind === 'config' ? snapshot.configs[button.key] : snapshot.settings[button.key];
  }
  function buttons(snapshot) {
    var result = [];
    (snapshot.settings.mapping_info || []).forEach(function (row) { Object.keys(row).forEach(function (key) { var value = row[key]; if (labels[key] && value && typeof value.app_id === 'string' && value.isActive !== false) result.push({key:key,name:labels[key],kind:'mapping',group:'apps'}); }); });
    [['com.webos.keyaction.tvGuide','Guide'],['com.webos.keyaction.inputHub','Home Hub']].forEach(function (item) { if (snapshot.configs[item[0]] && typeof snapshot.configs[item[0]] === 'object') result.push({key:item[0],name:item[1],kind:'config',group:'features'}); });
    [['customShortPress','Custom (?) · press'],['customLongPress','Custom (?) · hold']].forEach(function (item) { var value = snapshot.settings[item[0]]; if (value && typeof value.id === 'string') result.push({key:item[0],name:item[1],kind:'settings',group:'features'}); });
    return result;
  }
  function plan(button, target, snapshot, original, allowedTargets) {
    if (!buttons(snapshot).some(function (b) { return b.key === button.key && b.kind === button.kind; })) throw new Error('This button is unavailable.');
    var value;
    if (target === null) { if (!original || typeof original !== 'object') throw new Error('Original assignment is unavailable.'); value = clone(original); }
    else {
      if (!allowedTargets.some(function (item) { return canonical(item) === canonical(target); })) throw new Error('Unsupported target.');
      if (button.group === 'apps' && target.type !== 'app') throw new Error('Choose an app for an app button.');
      if (button.kind === 'mapping') value = Object.assign({}, entry(snapshot, button), {app_id:target.id,launch_param:Object.keys(target.params || {}).length ? JSON.stringify(target.params) : null,isActive:true});
      else if (button.kind === 'config') value = {action:'launch',id:target.id,params:clone(target.params || {}),fgAppIdsForByPass:[]};
      else value = Object.assign({}, entry(snapshot, button), {id:target.id,type:'app',params:clone(target.params || {})});
    }
    if (button.kind === 'config') { var configs = {}; configs[button.key] = value; return {uri:'com.webos.service.config/setConfigs',params:{configs:configs},expected:value}; }
    var settings = {};
    if (button.kind === 'mapping') {
      settings.mapping_info = clone(snapshot.settings.mapping_info);
      settings.mapping_info.forEach(function (row) { if (Object.prototype.hasOwnProperty.call(row, button.key)) row[button.key] = value; });
    } else settings[button.key] = value;
    return {uri:'com.webos.settingsservice/setSystemSettings',params:{category:'other',settings:settings},expected:value};
  }
  var api = {buttons:buttons,entry:entry,plan:plan,same:function (a,b) { return canonical(a) === canonical(b); }};
  root.QUIET_REMOTE_POLICY = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
