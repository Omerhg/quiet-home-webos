import {build,root} from './build.mjs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
const app=await build();await fs.mkdir(path.join(root,'dist'),{recursive:true});
const kind=process.argv[2];const input=kind==='mute'?path.join(root,'mute-helper'):app;
const executable=path.join(root,'node_modules','.bin',process.platform==='win32'?'ares-package.cmd':'ares-package');
const child=spawn(executable,[input,'-o',path.join(root,'dist')],{stdio:'inherit'});
child.on('exit',code=>process.exitCode=code??1);
