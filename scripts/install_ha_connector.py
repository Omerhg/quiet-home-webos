"""Install only the connector into an explicitly supplied HA config directory."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
# This same bounded operation runs locally or in an owner's existing HA container.
STAGE = r'''
import json,os,sys,time
from pathlib import Path
p=json.load(sys.stdin);root=Path(p['root']).resolve();config=root/'configuration.yaml'
text=config.read_text();line='quiet_home_lights: !include quiet_home_lights.yaml'
component=root/'custom_components/quiet_home_lights';settings=root/'quiet_home_lights.yaml'
if component.exists() or settings.exists() or 'quiet_home_lights:' in text:raise SystemExit('A connector already exists; inspect it instead of overwriting it.')
backup=root/'quiet_home_backups'/str(time.time_ns());backup.mkdir(parents=True,mode=0o700)
original=backup/'configuration.yaml';original.write_text(text);original.chmod(0o600)
try:
 component.mkdir(parents=True)
 for name,content in p['files'].items():(component/name).write_text(content)
 settings.write_text(json.dumps(p['settings'],indent=2)+'\n');settings.chmod(0o600)
 config.write_text(text.rstrip()+'\n\n'+line+'\n')
except BaseException:
 import shutil
 config.write_text(text)
 if component.exists():shutil.rmtree(component)
 if settings.exists():settings.unlink()
 raise
print('Connector installed. Existing scenes/automations were not changed. Validate HA configuration before restarting.')
'''

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--ha-config', type=Path)
    group.add_argument('--container', help='Existing HA Docker container; writes only its /config mount')
    args = parser.parse_args()
    source = ROOT / 'home-assistant/custom_components/quiet_home_lights'
    settings = json.loads((ROOT / '.local/ha/quiet_home_lights.yaml').read_text())
    payload = {'root': '/config' if args.container else str(args.ha_config.resolve()), 'settings': settings,
               'files': {p.name: p.read_text() for p in source.iterdir() if p.suffix in ['.py', '.json']}}
    command = ['docker', 'exec', '-i', args.container, 'python3', '-c', STAGE] if args.container else [sys.executable, '-I', '-c', STAGE]
    done = subprocess.run(command, input=json.dumps(payload), text=True, capture_output=True)
    if done.returncode: raise SystemExit('Connector installation refused or failed. Check for an existing connector and directory permissions. No private output is displayed.')
    print(done.stdout.strip())

if __name__ == '__main__': main()
