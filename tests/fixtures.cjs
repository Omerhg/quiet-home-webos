// Isolated test endpoints. No account or real network configuration is loaded.
const base=require('@playwright/test');
const test=base.test.extend({page:async({page},use)=>{
  await page.route('**/scene-config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.QUIET_SCENE_CONFIG={scenes:[{id:"scene.tv_time",title:"TV time",description:"Example scene",url:"http://127.0.0.1:8123/api/webhook/test-scene-hook"}]};'}));
  await page.route('http://127.0.0.1:8765/',async route=>{
    const response=await route.fetch();const body=(await response.text()).replace("connect-src 'none'",'connect-src http://127.0.0.1:8123');await route.fulfill({response,body});
  });
  await use(page);
}});
module.exports={test,expect:base.expect};
