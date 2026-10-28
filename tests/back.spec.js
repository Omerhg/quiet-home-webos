const {test,expect}=require('./fixtures.cjs');
async function nativeBack(page,options={}){
 await page.evaluate(options=>{
  for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{keyCode:options.named?0:461,key:options.named?'BrowserBack':'',bubbles:true,cancelable:true}));
 },options);
}
test('Back returns one menu level through gallery, content, categories and Home; native/named/release events are supported',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Open Settings'}).click();await page.getByRole('tab',{name:'Background',exact:true}).click();await page.getByRole('button',{name:/Choose rotation photos/}).click();
 await nativeBack(page);await expect(page.locator('#settings-title')).toHaveText('Background');await expect(page.locator('[data-choice=photos]')).toBeFocused();
 await nativeBack(page,{named:true});await expect(page.getByRole('tab',{name:'Background',exact:true})).toBeFocused();await expect(page.locator('#editor')).toBeVisible();
 await page.waitForTimeout(310); // A fresh release after the short app-resume orphan filter.
 await page.evaluate(()=>{const event=new KeyboardEvent('keyup',{bubbles:true,cancelable:true});Object.defineProperty(event,'which',{value:461});window.dispatchEvent(event);});
 await expect(page.locator('#editor')).toBeHidden();await expect(page.locator('.back-dot.filled')).toHaveCount(0);
});
test('history Back is routed inside Settings instead of leaving the app',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Open Settings'}).click();await page.getByRole('tab',{name:'Background',exact:true}).click();await page.getByRole('button',{name:/Choose rotation photos/}).click();
 await page.evaluate(()=>history.back());await expect(page.locator('#settings-title')).toHaveText('Background');await expect(page.locator('#editor')).toBeVisible();
 await expect(page).toHaveURL(/\/$/);
});
test('three Home Back presses fill hollow dots and enter photo mode without any HA or launch action',async({page})=>{
 const writes=[];page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});
 await page.addInitScript(()=>{window.launches=[];window.PalmServiceBridge=function(){this.call=(uri,p)=>{launches.push(uri);this.onservicecallback('{"returnValue":true}');};};});
 await page.clock.install();await page.goto('/');await expect(page.locator('.back-dot')).toHaveCount(3);await expect(page.locator('.back-dot.filled')).toHaveCount(0);
 await nativeBack(page);await expect(page.locator('.back-dot.filled')).toHaveCount(1);await nativeBack(page);await expect(page.locator('.back-dot.filled')).toHaveCount(2);
 await page.screenshot({path:'artifacts/back-progress-preview.png'});
 await nativeBack(page);await expect(page.locator('#screen')).toHaveClass(/scenery-mode/);await expect(page.locator('.back-dot.filled')).toHaveCount(3);
 await page.clock.fastForward(1000);await expect(page.locator('#back-progress')).toBeHidden();expect(writes).toHaveLength(0);expect(await page.evaluate(()=>launches)).toHaveLength(0);
 await nativeBack(page);await expect(page.locator('#screen')).not.toHaveClass(/scenery-mode/);await expect(page.locator('.back-dot.filled')).toHaveCount(0);
});
test('partial Back sequences expire, normal actions reset them, and holding Back cannot count as three presses',async({page})=>{
 await page.clock.install();await page.goto('/');await nativeBack(page);await page.clock.fastForward(2600);await expect(page.locator('.back-dot.filled')).toHaveCount(0);
 await nativeBack(page);await page.keyboard.press('ArrowRight');await expect(page.locator('.back-dot.filled')).toHaveCount(0);
 await page.evaluate(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:461,bubbles:true,cancelable:true}));for(let i=0;i<5;i++)window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:461,repeat:true,bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent('keyup',{keyCode:461,bubbles:true,cancelable:true}));});
 await expect(page.locator('.back-dot.filled')).toHaveCount(1);await expect(page.locator('#screen')).not.toHaveClass(/scenery-mode/);
});
test('manual photo mode temporarily shows a selected nature photo even with dark Home, and restores the original choice on wake',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('quiet-home.wallpaper.v1',JSON.stringify({mode:'glass',index:1,selected:['forest-falls.jpg']})));
 await page.goto('/');await expect(page.locator('#wallpapers img')).toHaveCount(0);
 await nativeBack(page);await nativeBack(page);await nativeBack(page);await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene','forest-falls.jpg');await expect(page.locator('#screen')).toHaveClass(/scenery-mode/);
 expect(await page.evaluate(()=>QUIET_WALLPAPERS.mode())).toBe('glass');await nativeBack(page);await expect(page.locator('#wallpapers img')).toHaveCount(0);expect(await page.evaluate(()=>QUIET_WALLPAPERS.mode())).toBe('glass');
});

test('a key and platform history event for the same Back press count once',async({page})=>{
 await page.clock.install();await page.goto('/');await page.clock.pauseAt(new Date(Date.now()+1000));
 await nativeBack(page);await page.evaluate(()=>history.back());await page.waitForTimeout(60);
 await expect(page.locator('.back-dot.filled')).toHaveCount(1);await nativeBack(page);await expect(page.locator('.back-dot.filled')).toHaveCount(2);
});
test('a still-photo preference stays still in manual picture mode and after returning',async({page})=>{
 await page.clock.install();await page.addInitScript(()=>localStorage.setItem('quiet-home.wallpaper.v1',JSON.stringify({mode:'still',index:1,selected:['forest-falls.jpg','desert-dusk.jpg']})));
 await page.goto('/');await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene','forest-falls.jpg');await nativeBack(page);await nativeBack(page);await nativeBack(page);
 await page.clock.fastForward(180001);await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene','forest-falls.jpg');await nativeBack(page);expect(await page.evaluate(()=>QUIET_WALLPAPERS.mode())).toBe('still');
});
