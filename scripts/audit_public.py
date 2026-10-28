"""Audit publishable files without printing matched secret values."""
import argparse
import ipaddress
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'.git', 'node_modules', '.local', '.build', 'dist', 'artifacts', 'test-results', 'playwright-report', '__pycache__', 'reports'}
PATTERNS = {
    'private key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'GitHub credential': re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})\b'),
    'JWT credential': re.compile(rb'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b'),
    'personal home directory': re.compile(rb'/(?:home|Users)/[A-Za-z0-9_.-]+/'),
    'MAC address': re.compile(rb'\b(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}\b'),
}

def candidates():
    result = subprocess.run(['git', 'ls-files', '-z', '--cached'], cwd=ROOT, capture_output=True)
    if result.returncode == 0 and result.stdout:
        return [ROOT / name.decode() for name in result.stdout.split(b'\0') if name]
    return [p for p in ROOT.rglob('*') if p.is_file() and not any(part in SKIP for part in p.relative_to(ROOT).parts)]

def audit(paths, known=()):
    findings = []
    for path in paths:
        relative = path.relative_to(ROOT)
        if any(part in SKIP for part in relative.parts) or path.suffix in ['.key', '.pem', '.ipk', '.zip', '.pyc'] or '.private.' in path.name or path.name.startswith('.env'):
            findings.append((str(relative), 'private/generated file staged')); continue
        data = path.read_bytes()
        if any(secret and secret in data for secret in known): findings.append((str(relative), 'known private value'))
        # Binary assets are still checked against the known-value list.
        try: data.decode('utf-8')
        except UnicodeDecodeError: continue
        for name, regex in PATTERNS.items():
            if regex.search(data): findings.append((str(relative), name))
        for match in re.findall(rb'(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])', data):
            try: address = ipaddress.ip_address(match.decode())
            except ValueError: continue
            if address.is_private and not address.is_loopback and str(address) not in ['0.0.0.0', '10.23.45.67', '192.0.2.1']:
                findings.append((str(relative), 'unexpected private network address')); break
    return sorted(set(findings))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--known-values', type=Path, help='Ignored external/private JSON array to compare in memory; values are never printed')
    args = parser.parse_args()
    known = []
    if args.known_values: known = [value.encode() for value in json.loads(args.known_values.read_text()) if isinstance(value, str) and len(value) >= 6]
    paths = candidates(); findings = audit(paths, known)
    if findings:
        for path, reason in findings: print(path + ': ' + reason)
        raise SystemExit(1)
    print('Privacy audit passed for ' + str(len(paths)) + ' publishable files. Matched values are never logged.')

if __name__ == '__main__': main()
