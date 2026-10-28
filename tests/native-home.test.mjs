import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=fs.readFileSync(new URL('../setup/payload.js',import.meta.url),'utf8');
const APP='com.quiet.home',STOCK='com.webos.app.home';
const SRC='/media/developer/apps/usr/palm/applications/'+APP+'/home-profile.json',TARGET='/var/webos-profile/override/quiet-home.json';
const parent='/var/webos-profile/override',clone=x=>JSON.parse(JSON.stringify(x));
function run(mode,options={}){
 const files=new Map(),dirs=new Set(['/var/webos-profile',...(options.missingDirectory?[]:[parent])]),calls=[];
 const original={defaultApps:{categories:{home:STOCK,aod:'com.webos.app.lifeonscreen'},support:true},idleApp:{appId:STOCK,support:true}};
 const setting=options.explicitHome?{home:STOCK,MembershipApp:'unchanged'}:{MembershipApp:'unchanged'};
 const bundle={defaultApps:{categories:{home:APP}},idleApp:{appId:APP}};
 if(options.override)files.set(TARGET,{kind:options.regular?'file':'link',target:options.override});
 const noent=()=>Object.assign(new Error('missing'),{code:'ENOENT'});
 const fakeFs={
  readFileSync(name){if(name==='/stage/operation.json')return JSON.stringify({mode});if(name===SRC){if(options.missingSource)throw noent();return JSON.stringify(options.badBundle?{...bundle,unexpected:true}:bundle);}throw noent();},
  writeFileSync(name,text){files.set(name,{kind:'file',text});},
  statSync(name){if(!dirs.has(name))throw noent();return {isDirectory:()=>true,uid:0,mode:options.unsafeDirectory?0o777:0o755};},
  lstatSync(name){if(!files.has(name))throw noent();return {isSymbolicLink:()=>files.get(name).kind==='link'};},
  mkdirSync(name){dirs.add(name);},
  symlinkSync(target,name){if(files.has(name))throw Object.assign(new Error('exists'),{code:'EEXIST'});files.set(name,{kind:'link',target});},
  readlinkSync(name){if(!files.has(name))throw noent();return files.get(name).target;},
  unlinkSync(name){assert.equal(name,TARGET);files.delete(name);},
  rmdirSync(name){assert.equal(name,parent);if(files.has(TARGET))throw Error('not empty');dirs.delete(name);}
 };
 let rescans=0;
 function current(){const p=clone(original);if(files.get(TARGET)?.target===SRC&&!options.missingSource){p.defaultApps.categories.home=APP;p.idleApp.appId=APP;}return p;}
 const fakeCp={execFileSync(exe,args){if(exe==='/bin/sync')return '';assert.equal(exe,'/usr/bin/luna-send');const method=args.at(-2),data=JSON.parse(args.at(-1));calls.push({method,data});
  if(method.endsWith('/getSystemInfo'))return JSON.stringify({returnValue:true,sdkVersion:options.sdk||'11.2.0'});
  if(method.endsWith('/getProfiles'))return JSON.stringify({returnValue:true,profiles:current()});
  if(method.endsWith('/getSystemSettings'))return JSON.stringify({returnValue:true,settings:{defaultApps:setting}});
  if(method.endsWith('/getAppInfo'))return JSON.stringify({returnValue:true,appInfo:{id:APP,version:'0.1.6',type:'web',appCategory:['home']}});
  if(method.endsWith('/debug/rescan')){rescans++;if(options.failRescan&&rescans===1)throw Error('simulated rescan failure');return JSON.stringify({returnValue:true});}
  throw Error('Unexpected API: '+method);
 }};
 const module={exports:{}};
 vm.runInNewContext(source,{require:n=>n==='fs'?fakeFs:fakeCp,module,__dirname:'/stage',process:{getuid:()=>options.uid??0,geteuid:()=>options.uid??0}},{timeout:1000});
 module.exports.run();
 return {result:JSON.parse(files.get('/stage/result.json').text),files,dirs,calls,original,setting};
}
test('probe reads without adding an override',()=>{const r=run('probe');assert.equal(r.result.status,'probe-passed');assert(!r.files.has(TARGET));assert(r.calls.every(c=>!c.method.endsWith('/setDefaultApp')));});
test('apply changes only the intended native destinations and preserves AOD/settings',()=>{const r=run('apply');assert.equal(r.result.status,'applied');assert.equal(r.files.get(TARGET).target,SRC);assert.equal(r.result.after.profiles.defaultApps.categories.aod,r.original.defaultApps.categories.aod);assert.deepEqual(r.result.after.setting,r.setting);});
test('an explicit Home setting blocks apply',()=>{const r=run('apply',{explicitHome:true});assert.equal(r.result.status,'error');assert(!r.files.has(TARGET));});
test('ordinary UID cannot apply',()=>{const r=run('apply',{uid:6631});assert.equal(r.result.status,'error');assert.equal(r.calls.length,0);assert(!r.files.has(TARGET));});
test('a different SDK cannot apply',()=>{const r=run('apply',{sdk:'10.3.1'});assert.equal(r.result.status,'error');assert(!r.files.has(TARGET));});
test('existing unrelated override is never overwritten',()=>{const r=run('apply',{override:'/someone-else/profile.json'});assert.equal(r.result.status,'error');assert.equal(r.files.get(TARGET).target,'/someone-else/profile.json');});
test('unexpected profile directory permissions block apply',()=>{const r=run('apply',{unsafeDirectory:true});assert.equal(r.result.status,'error');assert(!r.files.has(TARGET));});
test('malformed bundled data blocks apply',()=>{const r=run('apply',{badBundle:true});assert.equal(r.result.status,'error');assert(!r.files.has(TARGET));});
test('failed readback restores the newly created override',()=>{const r=run('apply',{failRescan:true});assert.equal(r.result.status,'error');assert(!r.files.has(TARGET));assert.deepEqual(r.result.rollback.profiles,r.original);assert.deepEqual(r.result.rollback.setting,r.setting);});
test('restore handles the owned dangling link without requiring the app',()=>{const r=run('restore',{override:SRC,missingSource:true});assert.equal(r.result.status,'restored');assert(!r.files.has(TARGET));assert(r.calls.every(c=>!c.method.endsWith('/getAppInfo')));});
test('restore never removes an unrelated regular file',()=>{const r=run('restore',{override:'unrelated',regular:true});assert.equal(r.result.status,'error');assert(r.files.has(TARGET));});
test('a missing override directory is created only during apply',()=>{const p=run('probe',{missingDirectory:true});assert.equal(p.result.status,'probe-passed');assert(!p.dirs.has(parent));const a=run('apply',{missingDirectory:true});assert.equal(a.result.status,'applied');assert(a.dirs.has(parent));});
test('failed apply also removes its own newly created empty directory',()=>{const r=run('apply',{missingDirectory:true,failRescan:true});assert.equal(r.result.status,'error');assert(!r.files.has(TARGET));assert(!r.dirs.has(parent));});
