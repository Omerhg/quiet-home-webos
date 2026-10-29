import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectDevice, parseSystemInfo, assessCompatibility} from '../scripts/lib/tv-compatibility.mjs';

test('CS5 43.21.77 with the tested SDK is unverified, not a firmware/model refusal', async () => {
  const calls = [];
  const report = await inspectDevice('friend-tv', async (...args) => {
    calls.push(args);
    return {stdout: '[Info] connection details omitted\nmodelName : OLED-CS5-DEMO\nfirmwareVersion : 43.21.77\nsdkVersion : 11.2.0\nboardType : NOT_FOR_REPORT\notaId : NOT_FOR_REPORT\n'};
  });
  assert.equal(calls.length, 1);
  assert(calls[0][0].endsWith('/node_modules/.bin/ares-device'));
  assert.deepEqual(calls[0][1], ['--device', 'friend-tv', '--system-info']);
  assert.equal(report.nativeHome.status, 'sdk-matches-unverified');
  assert.equal(report.nativeHome.modelOrFirmwareGate, false);
  assert.equal(report.nativeHome.readyForApply, false);
  assert.equal(report.nativeHome.privilegedBaselineChecked, false);
  assert.equal(report.device.firmwareVersion, '43.21.77');
  assert(!JSON.stringify(report).includes('NOT_FOR_REPORT'));
  assert(!JSON.stringify(report).includes('connection details'));
});

test('different SDK is classified without attempting any privileged operation', async () => {
  let count = 0;
  const report = await inspectDevice('friend-tv', async () => {
    count++;
    return {stdout: 'modelName : CS5\nfirmwareVersion : 43.21.77\nsdkVersion : 10.3.1\n'};
  });
  assert.equal(count, 1);
  assert.equal(report.nativeHome.status, 'unsupported-sdk');
  assert.equal(report.nativeHome.sdkGateMatches, false);
  assert.equal(report.nativeHome.readyForApply, false);
});

test('even the tested reference never becomes apply-ready from system information alone', () => {
  const report = assessCompatibility({modelName:'G6', firmwareVersion:'43.21.79', sdkVersion:'11.2.0'});
  assert.equal(report.nativeHome.status, 'sdk-matches-unverified');
  assert.equal(report.nativeHome.readyForApply, false);
});

test('missing SDK and CLI errors do not imply a firmware mismatch or leak raw output', async () => {
  assert.equal(assessCompatibility(parseSystemInfo('modelName : CS5')).nativeHome.status, 'sdk-unknown');
  await assert.rejects(inspectDevice('friend-tv', async () => {
    throw Error('DO_NOT_ECHO_PRIVATE_CONNECTION_DETAILS');
  }), error => !error.message.includes('DO_NOT_ECHO') && error.message.includes('No default-Home operation'));
});

test('malformed and duplicate system fields cannot produce a positive result', () => {
  assert.equal(parseSystemInfo('sdkVersion : 11.2.0<bad>').sdkVersion, null);
  assert.throws(() => parseSystemInfo('sdkVersion : 11.2.0\nsdkVersion : 10.3.1'), /Duplicate/);
});

test('device aliases cannot inject CLI options or shell commands', async () => {
  for (const device of ['--help', 'friend-tv; command', 'friend tv', '', undefined]) {
    await assert.rejects(inspectDevice(device, async () => { assert.fail('must not run CLI'); }), /alias/);
  }
});

test('inspect entry point never reaches native-Home server or payload staging', async () => {
  const source = fs.readFileSync(new URL('../scripts/native-home.mjs', import.meta.url), 'utf8');
  // Execute the actual command routing with every device/server/filesystem API
  // replaced by a tripwire. Only the injected inspectMain may run.
  const body = source.slice(source.indexOf('async function main()'));
  for (const args of [
    ['--device', 'friend-tv', '--mode', 'inspect'],
    ['--mode', 'inspect', '--device', 'friend-tv'],
  ]) {
    const calls = [];
    const tripwire = () => { assert.fail('privileged setup API must not run'); };
    const context = {
      process: {argv: ['node', '/project/scripts/native-home.mjs', ...args]},
      promisify: () => tripwire, execFile: tripwire,
      path: {resolve: () => '/project', dirname: () => '/project/scripts'},
      fileURLToPath: () => '/project/scripts/native-home.mjs',
      inspectMain: async args => { calls.push(args); },
      http: {createServer: tripwire}, fs: {readFile: tripwire},
      crypto: {randomBytes: tripwire},
    };
    // The URL is used only to compute a local path, not for command routing.
    await vm.runInNewContext(body.replace('import.meta.url', '"file:///project/scripts/native-home.mjs"').replace('await main();', 'main();'), context);
    assert.equal(JSON.stringify(calls), JSON.stringify([['--device', 'friend-tv']]));
  }
});

test('inspection CLI saves a private filtered report and fails when the SDK is unknown', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-inspect-test-'));
  try {
    fs.mkdirSync(path.join(directory, 'scripts', 'lib'), {recursive: true});
    fs.mkdirSync(path.join(directory, 'node_modules', '.bin'), {recursive: true});
    for (const file of ['inspect-tv.mjs', 'lib/tv-compatibility.mjs']) {
      fs.copyFileSync(new URL('../scripts/' + file, import.meta.url), path.join(directory, 'scripts', file));
    }
    // A local fake executable replaces the entire LG CLI. No TV is contacted.
    const fakeCLI = path.join(directory, 'node_modules', '.bin', 'ares-device');
    fs.writeFileSync(fakeCLI, '#!/bin/sh\n[ "$1" = "--device" ] && [ "$2" = "friend-tv" ] && [ "$3" = "--system-info" ] && [ "$#" = "3" ] || exit 2\nprintf "%s\\n" "modelName : CS5-DEMO" "firmwareVersion : 43.21.77" "sdkVersion : 11.2.0" "boardType : DO_NOT_EXPORT"\n', {mode: 0o700});
    const result = spawnSync(process.execPath, ['scripts/inspect-tv.mjs', '--device', 'friend-tv'], {cwd: directory, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert(!result.stdout.includes('DO_NOT_EXPORT'));
    const reports = path.join(directory, '.local', 'reports');
    const files = fs.readdirSync(reports);
    assert.equal(files.length, 1);
    const reportPath = path.join(reports, files[0]);
    assert.equal(fs.statSync(reportPath).mode & 0o777, 0o600);
    assert.equal(JSON.parse(fs.readFileSync(reportPath, 'utf8')).nativeHome.readyForApply, false);
    fs.writeFileSync(fakeCLI, '#!/bin/sh\nprintf "%s\\n" "modelName : CS5-DEMO"\n', {mode: 0o700});
    const unknown = spawnSync(process.execPath, ['scripts/inspect-tv.mjs', '--device', 'friend-tv'], {cwd: directory, encoding: 'utf8'});
    assert.equal(unknown.status, 1);
    assert(unknown.stdout.includes('sdk-unknown'));
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});
