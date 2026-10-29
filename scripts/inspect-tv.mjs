import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectDevice} from './lib/tv-compatibility.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function inspectMain(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== '--device') {
    throw Error('Usage: node scripts/inspect-tv.mjs --device friend-tv');
  }
  const report = await inspectDevice(args[1]);
  const directory = path.join(root, '.local', 'reports');
  await fs.mkdir(directory, {recursive: true, mode: 0o700});
  const filename = Date.now() + '-compatibility.json';
  await fs.writeFile(path.join(directory, filename), JSON.stringify(report, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  console.log(JSON.stringify(report, null, 2));
  console.log('Saved locally: .local/reports/' + filename);
  if (!report.device.sdkVersion) process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await inspectMain(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
