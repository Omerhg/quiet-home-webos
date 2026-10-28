// macOS/Linux helper. Never runs unless explicitly invoked by the TV owner.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import http from 'node:http';
import crypto from 'node:crypto';
const execute=promisify(execFile),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
function option(name){const i=args.indexOf(name);return i>=0?args[i+1]:undefined;}
const device=option('--device'),ip=option('--pc-ip'),mode=option('--mode');
if(!device||!ip||!['probe','apply','restore'].includes(mode))throw Error('Usage: node scripts/native-home.mjs --device friend-tv --pc-ip YOUR_LAN_IP --mode probe|apply|restore');
if(!/^[A-Za-z][A-Za-z0-9._-]*$/.test(device))throw Error('Use a simple CLI device alias.');
const octets=ip.split('.').map(Number);
if(octets.length!==4||octets.some(n=>!Number.isInteger(n)||n<0||n>255)||!(octets[0]===10||(octets[0]===192&&octets[1]===168)||(octets[0]===172&&octets[1]>=16&&octets[1]<=31)))throw Error('Use this computer\'s private LAN IPv4 address.');
const runId=Date.now()+'-'+crypto.randomBytes(4).toString('hex');
const stage='/media/developer/temp/quiet-home-share-'+runId;
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
const port=8780;
async function cli(name,args){return execute(path.join(root,'node_modules','.bin',name),args,{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});}
async function remote(cmd){return (await cli('ares-novacom',['--device',device,'--run',cmd])).stdout;}
const payload={inputParams:'quiet home setup /usr/palm/services/com.webos.service.secondscreen.gateway -- '+stage+'/cgroup unused '+stage};
const html='<!doctype html><meta charset="utf-8"><title>Quiet Home setup</title><style>body{background:#08090d;color:#ddd;font:28px sans-serif;padding:80px}pre{white-space:pre-wrap;font-size:20px}</style><h1>Quiet Home: '+mode+'</h1><p>One-time setup. This page does not install permanent root access.</p><pre id="result">Working…</pre><script>var b=new PalmServiceBridge();b.onservicecallback=function(t){document.getElementById("result").textContent=t;};b.call("luna://com.webos.service.jsserver/run",'+JSON.stringify(JSON.stringify(payload))+');</script>';
const server=http.createServer((req,res)=>{if(req.method!=='GET'||req.url!=='/index.html'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);});
let staged=false,finished=false;
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',resolve);});
  await remote('umask 077; mkdir '+quote(stage));staged=true;
  for(const file of ['package.json','services.json','payload.js']){
    const b=(await fs.readFile(path.join(root,'setup',file))).toString('base64');
    await remote("printf '%s' "+quote(b)+' | base64 -d > '+quote(stage+'/'+file));
  }
  const operation=Buffer.from(JSON.stringify({mode})).toString('base64');
  await remote("printf '%s' "+quote(operation)+' | base64 -d > '+quote(stage+'/operation.json'));
  console.log('Starting one-shot '+mode+' on device alias '+device+'.');
  await cli('ares-launch',['--device',device,'com.webos.app.voiceweb','--params',JSON.stringify({URL:'http://'+ip+':'+port+'/index.html',source:'quiet-home-share'})]);
  let result,lastError;
  const deadline=Date.now()+90000;
  while(Date.now()<deadline){
    try{const text=await remote('cat '+quote(stage+'/result.json'));result=JSON.parse(text.slice(text.indexOf('{')));break;}catch(e){lastError=e;}
    await new Promise(r=>setTimeout(r,1500));
  }
  if(!result)throw Error('No result was obtained. Check that the TV can reach this computer on port '+port+'. Inspect the TV page and '+stage+' before retrying. '+(lastError?.message||''));
  await fs.mkdir(path.join(root,'.local','reports'),{recursive:true});
  const reportFile=path.join(root,'.local','reports',runId+'-'+mode+'.json');
  await fs.writeFile(reportFile,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  finished=true;
  console.log(JSON.stringify(result,null,2));console.log('Saved: '+reportFile);
  if(result.status==='error'||result.rollbackError||result.status==='inspect-other-overrides')process.exitCode=1;
  else{try{await cli('ares-launch',['--device',device,mode==='restore'?'com.webos.app.home':'com.quiet.home']);}catch{console.log('Open Home with the remote after reviewing the result.');}}
}finally{
  await new Promise(resolve=>server.close(resolve));
  if(staged&&finished){try{await remote('rm -r '+quote(stage));}catch{console.log('Temporary setup directory retained for manual cleanup: '+stage);}}
  else if(staged)console.log('Setup files retained for diagnosis: '+stage+'. Do not delete them until the outcome is understood.');
}
