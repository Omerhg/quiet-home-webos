const { test, expect } = require('./fixtures.cjs');
const endpoint='http://127.0.0.1:8123/api/quiet_home_controls/test-controls-capability-with-32-characters';
const fixtures=()=>[
  {id:'fan.living',name:'Living room purifier',room:'Living room',kind:'fan',available:true,state:'on',on:true,speed:25,preset:null,presets:['auto','sleep'],actions:['power','speed','preset']},
  {id:'fan.bedroom',name:'Bedroom purifier',room:'Bedroom',kind:'fan',available:true,state:'on',on:true,speed:35,preset:'sleep',presets:['auto','sleep'],actions:['power','speed','preset']},
  {id:'cover.bedroom',name:'Bedroom window',room:'Bedroom',kind:'cover',available:true,state:'open',position:65,actions:['open','close','stop','position']},
  {id:'cover.office',name:'Office window',room:'Office',kind:'cover',available:true,state:'open',position:100,actions:['open','close','stop','position']},
  {id:'media_player.soundbar',name:'Soundbar',room:'Living room',kind:'media_player',available:true,state:'idle',volume:10,mute:false,actions:['volume','mute']},
  {id:'media_player.homepod',name:'HomePod',room:'Living room',kind:'media_player',available:true,state:'idle',volume:20,mute:null,actions:['volume']}
];
async function connection(page,options={}) {
 const calls=[],reads=[],devices=fixtures();
 await page.route('**/controls-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.QUIET_CONTROLS_CONFIG='+JSON.stringify({endpoint})+';'}));
 await page.route(endpoint,async r=>{
  const req=r.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});
  if(options.offline)return r.abort();
  if(req.method()==='POST'){const p=req.postDataJSON();calls.push(p);const d=devices.find(d=>d.id===p.id);if(['speed','position','volume','mute','preset'].includes(p.action))d[p.action]=p.value;if(p.action==='power')d.on=p.value;}else reads.push(req.method());
  await r.fulfill({headers,contentType:'application/json',body:JSON.stringify({devices,accepted:true})});
 }); return {calls,reads,devices};
}
test('control center shows six devices without acting, traps focus, scrolls remotely and stops polling on Back',async({page})=>{
 const {calls,reads}=await connection(page);await page.goto('/');expect(reads).toHaveLength(0);
 await page.getByRole('button',{name:'Open Home control center'}).click();await expect(page.locator('#control-devices .light-card')).toHaveCount(6);
 await expect(page.getByRole('slider',{name:'Bedroom window open position'})).toHaveValue('65');
 await expect(page.getByRole('switch',{name:'Living room purifier power'})).toHaveAttribute('aria-checked','true');
 await page.getByRole('button',{name:'Close Home controls'}).focus();
 for (let i=0;i<8;i++) await page.keyboard.press('ArrowDown');
 expect(await page.evaluate(()=>document.getElementById('control-devices').scrollTop)).toBeGreaterThan(0);
 for(let i=0;i<35;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('#controls-dialog'))).toBe(true);}
 expect(calls).toHaveLength(0);await page.screenshot({path:'artifacts/control-center-preview.png'});
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Open Home control center'})).toBeFocused();
 const count=reads.length;await page.waitForTimeout(2200);expect(reads).toHaveLength(count);
});
test('fan speed and modes, window position/stop and sound volume send only explicit commands',async({page})=>{
 const {calls}=await connection(page);await page.goto('/');await page.getByRole('button',{name:'Open Home control center'}).click();
 const speed=page.getByRole('slider',{name:'Living room purifier fan speed'});await expect(speed).toHaveValue('25');await speed.focus();await page.keyboard.press('ArrowRight');
 await expect.poll(()=>calls.length).toBe(1);expect(calls[0]).toEqual({id:'fan.living',action:'speed',value:30});
 await page.getByRole('button',{name:'Bedroom purifier Auto',exact:true}).click();await expect.poll(()=>calls.length).toBe(2);expect(calls[1]).toEqual({id:'fan.bedroom',action:'preset',value:'auto'});
 const position=page.getByRole('slider',{name:'Bedroom window open position'});await position.focus();await page.keyboard.press('ArrowLeft');
 await expect.poll(()=>calls.length).toBe(3);expect(calls[2]).toEqual({id:'cover.bedroom',action:'position',value:60});
 await page.getByRole('button',{name:'Bedroom window Stop',exact:true}).click();await expect.poll(()=>calls.length).toBe(4);expect(calls[3]).toEqual({id:'cover.bedroom',action:'stop',value:null});
 const volume=page.getByRole('slider',{name:'Soundbar volume'});await volume.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>calls.length).toBe(5);expect(calls[4]).toEqual({id:'media_player.soundbar',action:'volume',value:15});
 await page.getByRole('button',{name:'Soundbar Mute',exact:true}).click();await expect.poll(()=>calls.length).toBe(6);expect(calls[5]).toEqual({id:'media_player.soundbar',action:'mute',value:true});
 await expect(page.getByRole('button',{name:'HomePod Mute'})).toHaveCount(0);
});
test('Stop cancels a queued position change; popup does not trigger scenery and offline retry works',async({page})=>{
 const options={offline:true};const {calls}=await connection(page,options);await page.clock.install();await page.goto('/');await page.getByRole('button',{name:'Open Home control center'}).click();
 await expect(page.locator('#controls-status')).toContainText('unavailable');options.offline=false;await page.getByRole('button',{name:'Refresh Home controls'}).click();await expect(page.locator('#control-devices .light-card')).toHaveCount(6);
 await page.evaluate(()=>{const slider=document.querySelector('[data-device="cover.bedroom"] input');slider.value=40;slider.dispatchEvent(new Event('input'));document.querySelector('[aria-label="Bedroom window Stop"]').click();});
 await page.clock.runFor(200);await expect.poll(()=>calls.length).toBe(1);expect(calls[0]).toEqual({id:'cover.bedroom',action:'stop',value:null});
 await page.clock.fastForward(60000);await expect(page.locator('#screen')).not.toHaveClass(/scenery-mode/);
 await page.keyboard.press('Escape');await page.clock.fastForward(30100);await expect(page.locator('#screen')).toHaveClass(/scenery-mode/);
});
