// Only synthetic service responses are used. No TV or HA server is contacted.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),app=path.join(root,'app'),out=path.join(root,'docs','images');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),target=path.resolve(app,'.'+(pathname==='/'?'/index.html':pathname));if(!target.startsWith(app+path.sep))throw Error('invalid');res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_PATH?{executablePath:process.env.PLAYWRIGHT_CHROME_PATH}:{})});
try{
 await fs.mkdir(out,{recursive:true});const context=await browser.newContext({viewport:{width:1920,height:1080},locale:'en-US',timezoneId:'UTC',reducedMotion:'reduce'}),page=await context.newPage();
 await page.clock.install({time:new Date('2026-10-28T21:41:00Z')});
 await page.route('**/scene-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.QUIET_SCENE_CONFIG={scenes:[{id:"scene.tv_time",title:"TV time",description:"Example scene",url:"http://127.0.0.1:8123/api/webhook/screenshot-demo-only"}]};'}));
 await page.goto(url);await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>document.querySelector('#wallpapers img.is-visible')&&document.querySelector('#screen').dataset.glass==='cached');
 await page.screenshot({path:path.join(out,'home.png')});
 await page.getByRole('button',{name:'Open Settings'}).click();await page.getByRole('tab',{name:'Background',exact:true}).click();await page.screenshot({path:path.join(out,'settings.png')});
 await page.getByRole('button',{name:/Choose rotation photos/}).click();await page.screenshot({path:path.join(out,'landscapes.png')});
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.clock.fastForward(30100);await page.screenshot({path:path.join(out,'scenery.png')});
 await page.addInitScript(()=>{
  const data={settings:{mapping_info:[{netflix:{app_id:'netflix',launch_param:null,isActive:true}},{amazon:{app_id:'amazon',launch_param:null,isActive:true}}],customShortPress:{id:'com.webos.app.quickinputpicker',type:'app',params:{}}},configs:{'com.webos.keyaction.tvGuide':{action:'launch',id:'com.quiet.mute'},'com.webos.keyaction.inputHub':{action:'launch',id:'com.webos.app.homeconnect-overlay'}}};
  window.PalmServiceBridge=function(){this.call=(uri,text)=>{const p=JSON.parse(text);let result={returnValue:true};if(uri.endsWith('/getSystemSettings'))result.settings=Object.fromEntries(p.keys.filter(k=>k in data.settings).map(k=>[k,data.settings[k]]));if(uri.endsWith('/getConfigs'))result.configs=data.configs;this.onservicecallback(JSON.stringify(result));};};
 });
 await page.goto(url+'/remote.html?group=features');await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.getElementById('remote-button-title').textContent==='Guide');await page.getByRole('button',{name:'Mute / unmute',exact:true}).click();await page.screenshot({path:path.join(out,'remote.png')});
 await context.close();console.log('Saved five screenshots from the sanitized app and synthetic fixtures.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
