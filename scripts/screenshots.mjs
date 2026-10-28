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
 const controlsEndpoint='http://127.0.0.1:8123/api/quiet_home_controls/screenshot-demo-controls-0000000000';
 const lightsEndpoint='http://127.0.0.1:8123/api/quiet_home_lights/screenshot-demo-lighting-0000000000';
 await page.route(url+'/',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace("connect-src 'none'",'connect-src http://127.0.0.1:8123')});});
 await page.route('**/controls-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.QUIET_CONTROLS_CONFIG='+JSON.stringify({endpoint:controlsEndpoint})+';'}));
 await page.route('**/lights-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.QUIET_LIGHTS_CONFIG='+JSON.stringify({endpoint:lightsEndpoint})+';'}));
 const devices=[
  {id:'fan.living',name:'Living room purifier',room:'Living room',kind:'fan',available:true,state:'on',on:true,speed:25,preset:'auto',presets:['auto','sleep'],actions:['power','speed','preset']},
  {id:'fan.bedroom',name:'Bedroom purifier',room:'Bedroom',kind:'fan',available:true,state:'on',on:true,speed:35,preset:'sleep',presets:['auto','sleep'],actions:['power','speed','preset']},
  {id:'cover.bedroom',name:'Bedroom window',room:'Bedroom',kind:'cover',available:true,state:'open',position:65,actions:['open','close','stop','position']},
  {id:'cover.office',name:'Office window',room:'Office',kind:'cover',available:true,state:'open',position:100,actions:['open','close','stop','position']},
  {id:'media_player.soundbar',name:'Soundbar',room:'Living room',kind:'media_player',available:true,state:'idle',volume:20,mute:false,actions:['volume','mute']},
  {id:'media_player.homepod',name:'HomePod',room:'Living room',kind:'media_player',available:true,state:'idle',volume:15,actions:['volume']}
 ];
 const lights=[
  {id:'light.tv_light',name:'TV light',room:'Living room',available:true,on:true,brightness:20,dimmable:true},
  {id:'light.tv_backlight',name:'TV backlight',room:'Living room',available:true,on:true,brightness:80,dimmable:true,color:true,warmth:true,kelvin:2700,min_kelvin:2000,max_kelvin:6500},
  {id:'light.kitchen',name:'Kitchen light',room:'Kitchen',available:true,on:false,brightness:null,dimmable:true},
  {id:'switch.kitchen_sink',name:'Sink light',room:'Kitchen',available:true,on:false,dimmable:false}
 ];
 for(const [endpoint,body] of [[controlsEndpoint,{devices}],[lightsEndpoint,{lights}]])await page.route(endpoint,r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify(body)}));
 await page.goto(url);await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>document.querySelector('#wallpapers img.is-visible')&&document.querySelector('#screen').dataset.glass==='cached');
 await page.screenshot({path:path.join(out,'home.png')});
 await page.getByRole('button',{name:'Open Settings'}).click();await page.getByRole('tab',{name:'Background',exact:true}).click();await page.screenshot({path:path.join(out,'settings.png')});
 await page.getByRole('button',{name:/Choose rotation photos/}).click();await page.screenshot({path:path.join(out,'landscapes.png')});
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Open Home control center'}).click();await page.waitForFunction(()=>document.querySelectorAll('#control-devices .light-card').length===6);await page.screenshot({path:path.join(out,'controls.png')});
 await page.getByRole('button',{name:'Living room purifier details',exact:true}).click();await page.screenshot({path:path.join(out,'controls-expanded.png')});await page.getByRole('button',{name:'Close Home controls'}).click();
 await page.getByRole('button',{name:'Open lights'}).click();await page.waitForFunction(()=>document.querySelectorAll('#lighting-rooms .light-card').length===4);await page.getByRole('button',{name:'TV backlight details',exact:true}).click();await page.screenshot({path:path.join(out,'lights.png')});await page.getByRole('button',{name:'Close lights'}).click();
 await page.clock.fastForward(30100);await page.screenshot({path:path.join(out,'scenery.png')});
 await page.addInitScript(()=>{
  const data={settings:{mapping_info:[{netflix:{app_id:'netflix',launch_param:null,isActive:true}},{amazon:{app_id:'amazon',launch_param:null,isActive:true}}],customShortPress:{id:'com.webos.app.quickinputpicker',type:'app',params:{}}},configs:{'com.webos.keyaction.tvGuide':{action:'launch',id:'com.quiet.mute'},'com.webos.keyaction.inputHub':{action:'launch',id:'com.webos.app.homeconnect-overlay'}}};
  window.PalmServiceBridge=function(){this.call=(uri,text)=>{const p=JSON.parse(text);let result={returnValue:true};if(uri.endsWith('/getSystemSettings'))result.settings=Object.fromEntries(p.keys.filter(k=>k in data.settings).map(k=>[k,data.settings[k]]));if(uri.endsWith('/getConfigs'))result.configs=data.configs;this.onservicecallback(JSON.stringify(result));};};
 });
 await page.goto(url+'/remote.html?group=features');await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.getElementById('remote-button-title').textContent==='Guide');await page.getByRole('button',{name:'Mute / unmute',exact:true}).click();await page.screenshot({path:path.join(out,'remote.png')});
 await context.close();console.log('Saved eight screenshots from the sanitized app and synthetic fixtures.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
