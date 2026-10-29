import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const TESTED_SDK = '11.2.0';
const keys = ['modelName', 'firmwareVersion', 'sdkVersion'];

export function validateDeviceAlias(device) {
  if (typeof device !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(device)) {
    throw Error('Use a simple CLI device alias, such as friend-tv.');
  }
}

// ares-device emits "key : value" lines. Keep only public model/version fields;
// never include its raw output, board/OTA IDs, connection info or error details.
export function parseSystemInfo(stdout) {
  const info = Object.fromEntries(keys.map(key => [key, null]));
  for (const line of String(stdout).split(/\r?\n/)) {
    const match = /^\s*(modelName|firmwareVersion|sdkVersion)\s*:\s*([A-Za-z0-9._()+ -]{1,100})\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match, value = raw.trim();
    if (info[key] !== null) throw Error('Duplicate system-information field; inspect the CLI output locally.');
    if (key !== 'modelName' && !/^\d+\.\d+\.\d+$/.test(value)) continue;
    if (value) info[key] = value;
  }
  return info;
}

export function assessCompatibility(input) {
  const device = Object.fromEntries(keys.map(key => [key, input[key] || null]));
  const matches = device.sdkVersion === TESTED_SDK;
  const status = !device.sdkVersion ? 'sdk-unknown' : matches ? 'sdk-matches-unverified' : 'unsupported-sdk';
  const explanation = matches
    ? 'The SDK gate matches. This does not establish default-Home compatibility: the temporary-access path and all protected baseline checks remain untested on this TV.'
    : device.sdkVersion
      ? 'The native Home payload will refuse this SDK. Keep the SDK and baseline checks; use the ordinary app or a TV-native shortcut instead.'
      : 'The SDK could not be read. Check Developer Mode pairing and system information before considering native Home setup.';
  return {
    schemaVersion: 1,
    scope: 'ordinary-developer-mode-read-only',
    device,
    nativeHome: {
      status,
      testedReference: {modelFamily: 'G6', firmwareVersion: '43.21.79', sdkVersion: TESTED_SDK},
      modelOrFirmwareGate: false,
      sdkGateMatches: matches,
      privilegedBaselineChecked: false,
      readyForApply: false,
      explanation,
    },
    nextSteps: [
      'Install and test the ordinary launcher using docs/INSTALL.md; native Home compatibility is separate.',
      'For a shortcut without privileged setup, try LG Quick Access if this TV exposes the developer app there; see docs/COMPATIBILITY.md.',
      'Read docs/NATIVE-HOME.md before any privileged probe/apply/restore. Even probe uses temporary administrator execution.',
    ],
  };
}

// Exactly one ordinary CLI read. No TV file writes, page/app launch, local
// server, payload staging, trusted service invocation or privilege escalation.
export async function inspectDevice(device, runner = execute) {
  validateDeviceAlias(device);
  let stdout;
  try {
    ({stdout} = await runner(path.join(root, 'node_modules', '.bin', 'ares-device'),
      ['--device', device, '--system-info'],
      {encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024}));
  } catch {
    throw Error('Could not read TV system information. Check the device alias, network and Developer Mode key locally. No default-Home operation was attempted.');
  }
  return assessCompatibility(parseSystemInfo(stdout));
}
