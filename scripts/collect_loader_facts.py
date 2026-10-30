"""Read public loader fingerprints without invoking temporary privilege.

Use --from-root for extracted firmware, or --device for an owner's paired TV.
The device mode performs one ordinary ares-novacom SSH command that only reads
fixed OS files. Missing/denied files are unknown, never assumed patched.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
from datetime import datetime, timezone

REMOTE_READER = r'''
import hashlib, json, os
from pathlib import Path

def collect(root):
    paths = {
        'unified': 'usr/palm/nodejs/unified_service_server.js',
        'bootstrap': 'usr/palm/services/jsservicelauncher/bootstrap.js',
        'security': 'usr/palm/services/jsservicelauncher/security-utils.js',
        'voiceweb': 'usr/palm/applications/com.webos.app.voiceweb/appinfo.json',
        'release': 'etc/starfish-release',
    }
    result = {'scope': 'fixed-file reads only; no privilege attempt', 'readerUid': os.getuid(), 'files': {}}
    texts = {}
    for key, relative in paths.items():
        try:
            data = (Path(root) / relative).read_bytes()
            texts[key] = data.decode('utf-8')
            result['files'][key] = {'status':'readable','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
        except FileNotFoundError:
            result['files'][key] = {'status':'missing-in-reader-namespace'}
        except PermissionError:
            result['files'][key] = {'status':'permission-denied'}
        except (OSError, UnicodeError):
            result['files'][key] = {'status':'unavailable'}
    unified = texts.get('unified', '')
    bootstrap = texts.get('bootstrap', '')
    result['markers'] = {
        'initialArgumentIndexCheck': 'var servicePath = input_args[3]' in unified if 'unified' in texts else None,
        'finalLoadPathCheck': 'if (!isPathAllowed(service_dir))' in unified if 'unified' in texts else None,
        'bootstrapPathCheck': 'if (!securityUtils.isPathAllowed(paramsToScript[1]))' in bootstrap if 'bootstrap' in texts else None,
        'voicewebManifestReadable': 'voiceweb' in texts,
    }
    release = texts.get('release','').strip()
    # Fixed version string only. Do not return source code or arbitrary file data.
    if release.startswith('Rockhopper release ') and len(release) < 180:
        result['release'] = release
    if result['markers']['finalLoadPathCheck'] or result['markers']['bootstrapPathCheck']:
        result['candidate'] = 'known-path-parser-route-has-final-path-guards'
    elif result['markers']['initialArgumentIndexCheck'] and result['markers']['voicewebManifestReadable'] and 'bootstrap' in texts:
        result['candidate'] = 'older-parser-route-candidate-unverified'
    else:
        result['candidate'] = 'insufficient-evidence'
    result['privilegeVerified'] = False
    result['readyForApply'] = False
    return result
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--from-root', type=Path, help='Read an already extracted firmware root locally')
    group.add_argument('--device', help='Read fixed files through an already paired LG Developer Mode alias')
    parser.add_argument('--cli-dir', type=Path, default=Path.cwd() / 'node_modules' / '.bin')
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    parser.add_argument('--output', type=Path, default=Path('.local/reports') / (timestamp + '-loader-facts.json'),
                        help='New private JSON output file; default: ignored .local/reports/; never overwrite')
    args = parser.parse_args()
    if args.from_root:
        namespace = {}
        exec(REMOTE_READER, namespace)
        result = namespace['collect'](args.from_root)
        result['execution'] = 'local-extracted-image'
    else:
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9._-]*', args.device):
            parser.error('Use a simple paired device alias.')
        command = 'python3 -c ' + shlex.quote(REMOTE_READER + '\nprint(json.dumps(collect("/")))\n')
        try:
            response = subprocess.run([str(args.cli_dir / 'ares-novacom'), '--device', args.device, '--run', command],
                                      check=True, capture_output=True, text=True, timeout=25)
            # CLI may print an informational prefix. Parse only our one JSON line.
            lines = [line for line in response.stdout.splitlines() if line.startswith('{"scope":')]
            if len(lines) != 1:
                raise ValueError('No unique report')
            result = json.loads(lines[0])
            result['execution'] = 'ordinary-developer-account-reads'
        except (OSError, subprocess.SubprocessError, ValueError):
            print('Read failed. Check Developer Mode pairing and the local CLI path. Raw connection details are not printed.', file=sys.stderr)
            return 1
    args.output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with open(args.output, 'x', opener=lambda name, flags: os.open(name, flags, 0o600)) as output:
        json.dump(result, output, indent=2)
        output.write('\n')
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
