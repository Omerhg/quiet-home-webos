// Exercise the extracted firmware's real parser with in-memory dependencies.
// No TV connection, process launch, service/module execution or filesystem write
// from the firmware code is permitted. Only this harness writes its JSON report.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2);
function option(name) { const i=args.indexOf(name); return i < 0 ? null : args[i+1]; }
const reference=option('--reference-root'),candidate=option('--candidate-root'),patched=option('--patched-root');
if (!reference || !candidate || !patched) throw Error('Usage: node scripts/research/offline-loader-check.mjs --reference-root G6_3512_ROOT --candidate-root CS5_3706_ROOT --patched-root CS5_3711_ROOT [--output .local/reports/offline-loader-results.json]');
const output=option('--output') || '.local/reports/offline-loader-results.json';
const ORIGINAL_BOOTSTRAP='777a595a373c596092a5334a4c1412f19407ef9a16a0dcf679a5b54148b6602f';
const PATCHED_BOOTSTRAP='8f493c63b261d86ea5793d3d12a5c44fedfb81cd85390753ecb03e5160b16b88';
const PATCHED_SECURITY='c010b095073d794dc4a7694807e4b696448ed8f72ff086dbfaaf0edb32799f8a';
function readKnown(filename, digest) {
  const data=fs.readFileSync(filename);
  if (createHash('sha256').update(data).digest('hex') !== digest) throw Error('Unrecognized firmware source hash: '+filename);
  return data.toString('utf8');
}
const stage = '/media/developer/temp/quiet-research-demo';
const trusted = '/usr/palm/services/com.webos.service.secondscreen.gateway';
const roots = [
  {label:'G6 43.21.79 / SDK 11.2.0-3512 (comparison, not CS5)', directory:reference,bootstrapHash:ORIGINAL_BOOTSTRAP},
  {label:'CS5 43.21.96 / SDK 11.2.0-3711', directory:patched,bootstrapHash:PATCHED_BOOTSTRAP},
  {label:'CS5/C5 global 43.21.77 / SDK 11.2.0-3706 (matches photographed build)', directory:candidate,bootstrapHash:ORIGINAL_BOOTSTRAP},
];
const quiet = {log(){},error(){}};

function check(root, staged) {
  const changes=[], moduleLoads=[];
  const virtualFs = {
    existsSync(name) { return name === 'services.json'; },
    readFileSync(name) {
      assert.equal(name,'services.json');
      return JSON.stringify({id:'research.fixture.only'});
    },
    writeFileSync(name,data) { changes.push({operation:'virtual-write',path:name,bytes:data.length}); },
    realpathSync(name) {
      if ([stage,trusted].includes(name)) return name;
      throw Error('Virtual path does not exist');
    },
  };
  let security;
  const securityPath=path.join(root.directory,'usr/palm/services/jsservicelauncher/security-utils.js');
  if (fs.existsSync(securityPath)) {
    const exports={};
    vm.runInNewContext(readKnown(securityPath,PATCHED_SECURITY), {
      global:{fs:virtualFs,pmloglib:quiet},exports,
      require(){throw Error('Unexpected security-utils dependency');},
    },{timeout:1000});
    security=exports;
  }
  const exports={};
  const context={
    global:{fs:virtualFs,mojoloader:{},unified_service:{}},
    fs:virtualFs,exports,console:quiet,
    process:{version:'v0.0.0',pid:12345,chdir(name){changes.push({operation:'virtual-chdir',path:name});}},
    require(name){if(name==='./security-utils')return security;throw Error('Unexpected bootstrap dependency: '+name);},
  };
  vm.runInNewContext(readKnown(path.join(root.directory,'usr/palm/services/jsservicelauncher/bootstrap.js'),root.bootstrapHash),context,{timeout:1000});
  let status='parser-reached-load-callback',error=null;
  const selected=staged?stage:trusted;
  const params=['','','quiet','home','setup',trusted,'--',stage+'/cgroup','unused',selected];
  try { exports.parse((args,id)=>moduleLoads.push({path:args[1],id}),params); }
  catch(e) { status='rejected-before-load';error=e.message; }
  return {label:root.label,requestedPath:selected,status,error,changes,moduleLoads,privilegeVerified:false};
}

const results=roots.flatMap(root=>[check(root,true),check(root,false)]);
assert.equal(results[0].moduleLoads[0].path,stage);
assert.equal(results[2].status,'rejected-before-load');
assert.equal(results[2].moduleLoads.length,0);
assert(!results[2].changes.some(item=>item.operation==='virtual-chdir'));
for(const index of [1,3])assert.equal(results[index].moduleLoads[0].path,trusted);
assert.equal(results[4].moduleLoads[0].path,stage);
assert.equal(results[5].moduleLoads[0].path,trusted);
const report={scope:'offline firmware parser simulation; not root or TV validation',results};
fs.mkdirSync(path.dirname(output),{recursive:true,mode:0o700});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify(report,null,2));
