import {build} from './build.mjs';
import {spawn} from 'node:child_process';
const app=await build();const child=spawn('python3',['-I','-m','http.server','8765','--bind','127.0.0.1','--directory',app],{stdio:'inherit'});
process.on('SIGINT',()=>child.kill('SIGINT'));child.on('exit',code=>process.exitCode=code??1);
