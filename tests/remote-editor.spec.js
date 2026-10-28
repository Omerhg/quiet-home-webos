const {test,expect}=require('./fixtures.cjs');
const fs=require('node:fs'),path=require('node:path');

async function native(page){
 await page.addInitScript(()=>{
  window.remoteCalls=[];window.failWrite=false;window.installedApps=null;
  window.remoteState={settings:{mapping_info:[{netflix:{app_id:'netflix',launch_param:'hotkey',isActive:true,keep:'metadata'}},{amazon:{app_id:'amazon',launch_param:null,isActive:true}}],customShortPress:{id:'com.webos.app.quickinputpicker',type:'app',params:{}},customLongPress:{id:'com.webos.app.accessibility',type:'app',params:{}}},configs:{'com.webos.keyaction.tvGuide':{action:'launch',id:'com.quiet.mute',params:{},fgAppIdsForByPass:[]},'com.webos.keyaction.inputHub':{action:'launch',id:'com.webos.app.homeconnect-overlay'}}};
  if(localStorage.getItem('test.remoteState'))window.remoteState=JSON.parse(localStorage.getItem('test.remoteState'));
  window.PalmServiceBridge=function(){this.call=(uri,json)=>{
   const p=JSON.parse(json);remoteCalls.push({uri,p});let r={returnValue:true};
   if(uri.endsWith('/getSystemSettings'))r.settings=Object.fromEntries(p.keys.filter(k=>k in remoteState.settings).map(k=>[k,remoteState.settings[k]]));
   if(uri.endsWith('/listApps')&&installedApps)r.apps=installedApps;
   if(uri.endsWith('/getConfigs'))r.configs=remoteState.configs;
   if(uri.endsWith('/setSystemSettings')){if(failWrite)r.returnValue=false;else Object.assign(remoteState.settings,p.settings);}
   if(uri.endsWith('/setConfigs')){if(failWrite)r.returnValue=false;else Object.assign(remoteState.configs,p.configs);}
   if(r.returnValue&&/\/(setConfigs|setSystemSettings)$/.test(uri))localStorage.setItem('test.remoteState',JSON.stringify(remoteState));
   this.onservicecallback(JSON.stringify(r));
  };};
 });
}
async function writes(page){return page.evaluate(()=>remoteCalls.filter(c=>/\/(setConfigs|setSystemSettings)$/.test(c.uri)));}
test('app shortcuts choose any catalog app, save explicitly, preserve neighboring mappings and restore exactly',async({page})=>{
 await native(page);await page.goto('/remote.html');await expect(page.locator('#remote-button-title')).toHaveText('Netflix');
 await page.getByRole('button',{name:'Jellyfin',exact:true}).click();expect(await writes(page)).toHaveLength(0);
 await page.getByRole('button',{name:'Save assignment'}).click();await expect(page.locator('#remote-status')).toContainText('Netflix now opens Jellyfin');
 const state=await page.evaluate(()=>remoteState.settings.mapping_info);
 expect(state).toEqual([{netflix:{app_id:'org.jellyfin.webos',launch_param:null,isActive:true,keep:'metadata'}},{amazon:{app_id:'amazon',launch_param:null,isActive:true}}]);
 expect(await page.evaluate(()=>remoteCalls.filter(c=>c.uri.endsWith('/launch')))).toHaveLength(0);
 await page.screenshot({path:'artifacts/remote-app-buttons-preview.png'});
 await page.reload();await expect(page.locator('#remote-current')).toHaveText('Current: Jellyfin');
 await page.getByRole('button',{name:'Restore original'}).click();await expect(page.locator('#remote-status')).toContainText('restored');
 expect(await page.evaluate(()=>remoteState.settings.mapping_info[0].netflix)).toEqual({app_id:'netflix',launch_param:'hotkey',isActive:true,keep:'metadata'});
});
test('Guide offers features and inputs, restores the recorded original and settings do not activate features',async({page})=>{
 await native(page);await page.goto('/remote.html?group=features');await expect(page.locator('#remote-button-title')).toHaveText('Guide');
 await page.getByRole('button',{name:'Lights',exact:true}).click();expect(await writes(page)).toHaveLength(0);
 await page.getByRole('button',{name:'Save assignment'}).click();await expect(page.locator('#remote-status')).toContainText('Guide now opens Lights');
 expect((await writes(page))[0].p).toEqual({configs:{'com.webos.keyaction.tvGuide':{action:'launch',id:'com.quiet.home',params:{action:'lights'},fgAppIdsForByPass:[]}}});
 expect(await page.evaluate(()=>remoteCalls.filter(c=>c.uri.endsWith('/launch')))).toHaveLength(0);
 await page.screenshot({path:'artifacts/remote-features-preview.png'});
 await page.getByRole('button',{name:'Restore original'}).click();await expect(page.locator('#remote-status')).toContainText('restored');expect(await page.evaluate(()=>remoteState.configs['com.webos.keyaction.tvGuide'])).toEqual({action:'launch',id:'com.quiet.mute',params:{},fgAppIdsForByPass:[]});
 await page.getByRole('button',{name:'Custom (?) · press',exact:true}).click();await page.getByRole('tab',{name:'Inputs',exact:true}).click();
 await page.locator('#remote-targets button').first().click();await page.getByRole('button',{name:'Save assignment'}).click();await expect(page.locator('#remote-status')).toContainText('now opens');
 const request=(await writes(page)).at(-1);expect(Object.keys(request.p.settings)).toEqual(['customShortPress']);expect(request.p.settings.customShortPress.id).toBe('com.webos.app.hdmi1');
});
test('unsupported keys are explicit; navigation scrolls action lists; failed writes remain recoverable',async({page})=>{
 await native(page);await page.goto('/remote.html?group=features');await expect(page.locator('#remote-button-title')).toHaveText('Guide');
 await page.getByRole('button',{name:'System buttons',exact:true}).click();await expect(page.locator('#remote-system-note')).toBeVisible();await expect(page.getByRole('button',{name:'Save assignment'})).toBeDisabled();expect(await writes(page)).toHaveLength(0);
 await page.getByRole('button',{name:'Other buttons',exact:true}).click();await page.getByRole('tab',{name:'Apps',exact:true}).click();
 await page.locator('#remote-targets button').first().focus();for(let i=0;i<12;i++)await page.keyboard.press('ArrowDown');
 expect(await page.locator('#remote-targets').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
 await page.getByRole('tab',{name:'Features',exact:true}).click();await page.getByRole('button',{name:'Mute / unmute',exact:true}).click();await page.evaluate(()=>failWrite=true);
 await page.getByRole('button',{name:'Save assignment'}).click();await expect(page.locator('#remote-status')).toContainText('did not allow');
 await expect(page.getByRole('button',{name:'Back to Settings',exact:true}).last()).toBeEnabled();
 expect(await page.evaluate(()=>remoteState.configs['com.webos.keyaction.tvGuide'].id)).toBe('com.quiet.mute');
});

test('app picker reads newly installed visible apps rather than being limited to favorites',async({page})=>{
 await native(page);await page.goto('/remote.html');await expect(page.locator('#remote-button-title')).toHaveText('Netflix');
 await page.evaluate(()=>{installedApps=[{id:'org.jellyfin.webos',title:'Jellyfin',visible:true},{id:'com.friend.newapp',title:'New installed app',visible:true},{id:'com.hidden.service',title:'Hidden service',visible:false}];document.getElementById('remote-retry').click();});
 await expect(page.getByRole('button',{name:'New installed app',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Hidden service',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'New installed app',exact:true}).click();expect(await writes(page)).toHaveLength(0);
 await page.getByRole('button',{name:'Save assignment'}).click();await expect(page.locator('#remote-status')).toContainText('Netflix now opens New installed app');
 expect(await page.evaluate(()=>remoteState.settings.mapping_info[0].netflix.app_id)).toBe('com.friend.newapp');
});
