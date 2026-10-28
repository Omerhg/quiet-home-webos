import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function build() {
  const target=path.join(root,'.build','app');
  await fs.rm(target,{recursive:true,force:true});await fs.mkdir(path.dirname(target),{recursive:true});await fs.cp(path.join(root,'app'),target,{recursive:true});
  let config;
  try{config=JSON.parse(await fs.readFile(path.join(root,'.local','config.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(config?.homeAssistant){
    const ha=config.homeAssistant,parsed=new URL(ha.origin);
    if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')throw new Error('Use an HTTP(S) HA origin without credentials, path, query or fragment.');
    if(!/^[A-Za-z0-9_-]{32,}$/.test(ha.capability)||ha.capability.startsWith('REPLACE_'))throw new Error('Generate a fresh local capability before building HA support.');
    const origin=parsed.origin;
    for(const [name,object] of [
      ['lights-config.js',{endpoint:origin+'/api/quiet_home_lights/'+ha.capability}],
      ['controls-config.js',{endpoint:origin+'/api/quiet_home_controls/'+ha.capability}],
      ['scene-config.js',{scenes:(ha.scenes||[]).map(scene=>{
        if(!/^scene\.[a-z0-9_]+$/.test(scene.id)||!/^[A-Za-z0-9_-]{32,}$/.test(scene.webhookId)||scene.webhookId.startsWith('REPLACE_'))throw new Error('Use real scene entity IDs and fresh local webhook IDs.');
        return {id:scene.id,title:scene.title,description:scene.description||'',url:origin+'/api/webhook/'+scene.webhookId};
      })}]
    ]){
      const globalName={'lights-config.js':'QUIET_LIGHTS_CONFIG','controls-config.js':'QUIET_CONTROLS_CONFIG','scene-config.js':'QUIET_SCENE_CONFIG'}[name];
      await fs.writeFile(path.join(target,name),'window.'+globalName+' = '+JSON.stringify(object,null,2)+';\n',{mode:0o600});
    }
    const index=path.join(target,'index.html');await fs.writeFile(index,(await fs.readFile(index,'utf8')).replace("connect-src 'none'",'connect-src '+origin));
  }
  console.log('Built .build/app'+(config?.homeAssistant?' with private local HA configuration.':' with HA disabled.'));
  return target;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
