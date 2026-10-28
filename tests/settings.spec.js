const {test,expect}=require('./fixtures.cjs');
test('settings sidebar navigates predictably, keeps the pane in place and shows fixed photo counts',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Open Settings'}).click();
 const apps=page.getByRole('tab',{name:'Apps',exact:true});await expect(apps).toBeFocused();
 await page.keyboard.press('ArrowDown');await expect(page.getByRole('tab',{name:'Inputs',exact:true})).toBeFocused();await expect(apps).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowRight');
 await expect(page.locator('#settings-title')).toHaveText('Background');await expect(page.locator('[data-choice=rotate]')).toBeFocused();
 await page.getByRole('button',{name:/Choose rotation photos/}).click();await expect(page.locator('#settings-summary')).toHaveText('12 of 12 selected');
 for(let i=0;i<3;i++)await page.keyboard.press('ArrowDown');
 const selected=page.locator('#choices .photo-choice:focus');await expect(selected).toBeInViewport();
 const before=await page.locator('#choices').evaluate(e=>e.scrollTop);
 expect(before).toBeGreaterThan(0);
 await page.keyboard.press('Enter');await expect(page.locator('#settings-summary')).toHaveText('11 of 12 selected');
 expect(await page.locator('#choices').evaluate(e=>e.scrollTop)).toBe(before);
 await page.screenshot({path:'artifacts/settings-gallery-preview.png'});
 await page.keyboard.press('Escape');await expect(page.locator('#settings-title')).toHaveText('Background');await expect(page.locator('[data-choice=photos]')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#editor')).toBeHidden();
});
test('all categories fit without scrolling the sidebar and selecting apps preserves content scroll',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Open Settings'}).click();
 await expect(page.getByRole('tab',{name:'Remote',exact:true})).toBeInViewport();
 await expect(page.locator('#editor .tab')).toHaveCount(6);
 const last=page.locator('#choices .choice').last();await last.focus();await expect(last).toBeInViewport();
 const scroll=await page.locator('#choices').evaluate(e=>e.scrollTop);await last.click();expect(await page.locator('#choices').evaluate(e=>e.scrollTop)).toBe(scroll);
 await page.getByRole('tab',{name:'Remote',exact:true}).click();await expect(page.locator('#remote-buttons')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/App shortcut buttons/})).toBeVisible();
 await expect(page.locator('#choices')).toContainText('system-controlled');
 await page.getByRole('tab',{name:'Background',exact:true}).click();await page.screenshot({path:'artifacts/settings-background-preview.png'});
 await page.getByRole('tab',{name:'Apps',exact:true}).click();await page.screenshot({path:'artifacts/settings-apps-preview.png'});
 for(let i=0;i<30;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('#editor'))).toBe(true);}
});
test('remote launch actions open the correct Home view without rewriting mappings',async({page})=>{
 const writes=[];page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});
 await page.goto('/');
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('webOSRelaunch',{detail:{settings:'remote'}})));
 await expect(page.locator('#editor')).toBeVisible();await expect(page.locator('#settings-title')).toHaveText('Remote');
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('webOSRelaunch',{detail:{action:'scenery'}})));
 await expect(page.locator('#editor')).toBeHidden();await expect(page.locator('#screen')).toHaveClass(/scenery-mode/);
 await page.keyboard.press('Enter');await expect(page.locator('#screen')).not.toHaveClass(/scenery-mode/);expect(writes).toHaveLength(0);
});
