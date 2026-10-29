'use strict';
// Adapted export of the one-shot operations used on the original TV.
// No root shell, listening socket, boot hook, installer or renewal timer.
var fs = require('fs'), cp = require('child_process');
var APP = 'com.quiet.home', STOCK = 'com.webos.app.home';
var SOURCE = '/media/developer/apps/usr/palm/applications/' + APP + '/home-profile.json';
var TARGET = '/var/webos-profile/override/quiet-home.json';
var BASE = __dirname;
function call(method, payload) {
  var text = cp.execFileSync('/usr/bin/luna-send', ['-n','1','-w','3000','luna://' + method, JSON.stringify(payload || {})],
    {encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe']});
  var value = JSON.parse(text);
  if (value.returnValue !== true) throw new Error(method + ': ' + text);
  return value;
}
function profiles() { return call('com.webos.service.systemprofile/getProfiles', {names:['defaultApps','idleApp']}).profiles; }
function setting() { return call('com.webos.settingsservice/getSystemSettings', {category:'general',keys:['defaultApps']}).settings.defaultApps; }
function linkExists() { try { fs.lstatSync(TARGET); return true; } catch(e) { if(e.code === 'ENOENT') return false; throw e; } }
function save(name, value) { fs.writeFileSync(BASE + '/' + name, JSON.stringify(value,null,2) + '\n', {mode:0o644}); }
function trustedDirectory(name) {
  var dir = fs.statSync(name);
  if (!dir.isDirectory() || dir.uid !== 0 || (dir.mode & 0o022)) throw new Error('Unexpected profile directory or permissions: ' + name);
}
function validate(before) {
  var p = before.profiles;
  if (!p || !p.defaultApps || !p.idleApp || p.defaultApps.categories.home !== STOCK || p.idleApp.appId !== STOCK || p.idleApp.support !== true)
    throw new Error('Home profiles differ from the tested stock baseline. Stop and investigate.');
  if (!before.setting || Object.prototype.hasOwnProperty.call(before.setting, 'home'))
    throw new Error('An explicit defaultApps.home setting exists. This export does not change or reset it.');
  var info = call('com.webos.applicationManager/getAppInfo', {id:APP}).appInfo;
  if (!info || info.type !== 'web' || !info.appCategory || info.appCategory.indexOf('home') < 0)
    throw new Error('The installed launcher must be a web app registered in appCategory home.');
  var expected = {defaultApps:{categories:{home:APP}},idleApp:{appId:APP}};
  if (JSON.stringify(JSON.parse(fs.readFileSync(SOURCE,'utf8'))) !== JSON.stringify(expected))
    throw new Error('The bundled Home profile differs from this export.');
  if (linkExists()) throw new Error('An existing Home override is present; it will not be overwritten.');
  trustedDirectory('/var/webos-profile');
  try { trustedDirectory('/var/webos-profile/override'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  return {id:info.id,version:info.version,type:info.type,appCategory:info.appCategory};
}
module.exports.run = function () {
  var result = {uid:process.getuid(),euid:process.geteuid()}, created = false, createdDirectory = false;
  try {
    var mode = JSON.parse(fs.readFileSync(BASE + '/operation.json','utf8')).mode;
    result.mode = mode;
    if (['probe','apply','restore'].indexOf(mode) < 0) throw new Error('Unknown operation.');
    if (result.uid !== 0 || result.euid !== 0) throw new Error('Temporary administrator access was not obtained.');
    result.sdk = call('com.webos.service.tv.systemproperty/getSystemInfo', {keys:['sdkVersion']});
    if (result.sdk.sdkVersion !== '11.2.0') throw new Error('Unsupported internal SDK: ' + result.sdk.sdkVersion + '. This export requires SDK 11.2.0, not a specific model name or software number. Run the ordinary read-only inspect command; do not remove this check.');
    var before = {profiles:profiles(),setting:setting()};
    result.before = before;
    if (mode === 'probe' || mode === 'apply') {
      result.launcher = validate(before);
      result.readyForApply = true;
    }
    if (mode === 'apply') {
      save('baseline.json', before); // Record the original values before mutation.
      cp.execFileSync('/bin/sync',[],{timeout:10000,stdio:'ignore'});
      try { trustedDirectory('/var/webos-profile/override'); }
      catch (e) { if (e.code !== 'ENOENT') throw e; fs.mkdirSync('/var/webos-profile/override',{mode:0o755}); createdDirectory = true; }
      result.createdOverrideDirectory = createdDirectory;
      fs.symlinkSync(SOURCE,TARGET); created = true;
      call('com.webos.service.systemprofile/debug/rescan');
      result.after = {profiles:profiles(),setting:setting()};
      var p = result.after.profiles;
      if (p.defaultApps.categories.home !== APP || p.idleApp.appId !== APP || JSON.stringify(result.after.setting) !== JSON.stringify(before.setting))
        throw new Error('Native Home readback failed; restoring the owned change.');
      cp.execFileSync('/bin/sync',[],{timeout:10000,stdio:'ignore'});
      result.status = 'applied';
    } else if (mode === 'restore') {
      if (linkExists()) {
        if (!fs.lstatSync(TARGET).isSymbolicLink() || fs.readlinkSync(TARGET) !== SOURCE)
          throw new Error('The existing override is not this export\'s link; refusing to remove it.');
        fs.unlinkSync(TARGET);
        call('com.webos.service.systemprofile/debug/rescan');
      }
      result.after = {profiles:profiles(),setting:setting()};
      result.lgHomeRestored = result.after.profiles.defaultApps.categories.home === STOCK && result.after.profiles.idleApp.appId === STOCK;
      result.status = result.lgHomeRestored ? 'restored' : 'inspect-other-overrides';
      cp.execFileSync('/bin/sync',[],{timeout:10000,stdio:'ignore'});
    } else result.status = 'probe-passed';
  } catch (e) {
    result.status = 'error'; result.error = e.message;
    if (created) {
      try {
        if (!fs.lstatSync(TARGET).isSymbolicLink() || fs.readlinkSync(TARGET) !== SOURCE) throw new Error('The link changed independently.');
        fs.unlinkSync(TARGET); call('com.webos.service.systemprofile/debug/rescan');
        result.rollback = {profiles:profiles(),setting:setting()};
      } catch (cleanup) { result.rollbackError = cleanup.message; }
    }
    if (createdDirectory) {
      try { fs.rmdirSync('/var/webos-profile/override'); }
      catch (directoryCleanup) { result.directoryCleanupNote = directoryCleanup.message; }
    }
  }
  save('result.json', result);
};
