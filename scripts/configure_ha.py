"""Generate local HA configuration; never contact HA, activate devices, or restart it."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

def private_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False); handle.write('\n')
    path.chmod(0o600)

def generate(config):
    ha = config.get('homeAssistant')
    if not isinstance(ha, dict): raise ValueError('Expected a homeAssistant object')
    origin = urlsplit(ha.get('origin', ''))
    if origin.scheme not in ['http', 'https'] or not origin.hostname or origin.username or origin.password or origin.path not in ['', '/'] or origin.query or origin.fragment:
        raise ValueError('Set a valid HTTP(S) Home Assistant origin without credentials or a path')
    lights, controls = ha.get('lights', []), ha.get('controls', [])
    if not lights: raise ValueError('Configure at least one light')
    ids = set()
    for group, domains in [(lights, ['light', 'switch']), (controls, ['fan', 'cover', 'media_player'])]:
        if not isinstance(group, list): raise ValueError('Entity definitions must be lists')
        for item in group:
            entity = item.get('id', '')
            if not re.fullmatch(r'[a-z_]+\.[a-z0-9_]+', entity) or entity.split('.')[0] not in domains or entity in ids:
                raise ValueError('Entity IDs must be unique and have a supported domain')
            if not isinstance(item.get('name'), str) or not item['name'] or not isinstance(item.get('room'), str) or not item['room']:
                raise ValueError('Each device needs a name and room')
            if group is lights and item['room'] not in ['Living room', 'Kitchen']:
                raise ValueError('The lighting popup currently supports Living room and Kitchen')
            ids.add(entity)
    token = ha.get('capability', '')
    if not token or token.startswith('REPLACE_'): ha['capability'] = secrets.token_urlsafe(32)
    elif not re.fullmatch(r'[A-Za-z0-9_-]{32,}', token): raise ValueError('Invalid capability')
    for scene in ha.get('scenes', []):
        if not re.fullmatch(r'scene\.[a-z0-9_]+', scene.get('id', '')): raise ValueError('Invalid scene entity ID')
        hook = scene.get('webhookId', '')
        if not hook or hook.startswith('REPLACE_'): scene['webhookId'] = secrets.token_urlsafe(32)
        elif not re.fullmatch(r'[A-Za-z0-9_-]{32,}', hook): raise ValueError('Invalid scene webhook ID')
    settings = {'token': ha['capability'], 'lights': lights, 'controls': controls}
    # The example scene uses explicit roles rather than guessing entity names.
    roles = ha.get('tvTime', {})
    scene = None
    if roles:
        for entity in [roles.get('tvLight'), roles.get('backlight'), *roles.get('off', [])]:
            if entity not in ids: raise ValueError('TV time entities must be in the configured allowlist')
        if not roles['tvLight'].startswith('light.') or not roles['backlight'].startswith('light.'):
            raise ValueError('TV light and backlight need dimmable light entities')
        scene = {'id': 'quiet_home_tv_time', 'name': 'TV time', 'icon': 'mdi:television-ambient-light', 'entities': {
            roles['tvLight']: {'state': 'on', 'brightness': 51}, roles['backlight']: {'state': 'on', 'brightness': 204},
            **{entity: {'state': 'off'} for entity in roles.get('off', [])}}}
    automations = []
    for index, definition in enumerate(ha.get('scenes', [])):
        automations.append({'id': 'quiet_home_scene_button_' + str(index), 'alias': 'Quiet Home — ' + definition['title'],
            'triggers': [{'trigger': 'webhook', 'webhook_id': definition['webhookId'], 'allowed_methods': ['POST'], 'local_only': True}],
            'conditions': [{'condition': 'template', 'value_template': "{{ trigger.data.get('dry_run', '') != '1' }}"}],
            'actions': [{'action': 'scene.turn_on', 'target': {'entity_id': definition['id']}}], 'mode': 'single'})
    return settings, scene, automations

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=ROOT / '.local/config.json')
    parser.add_argument('--check', action='store_true', help='Validate without writing files')
    args = parser.parse_args()
    try:
        config = json.loads(args.config.read_text()); settings, scene, automations = generate(config)
        if args.check:
            print('Local configuration is valid. No files or devices changed.'); return
        private_json(args.config, config)
        output = ROOT / '.local/ha'
        private_json(output / 'quiet_home_lights.yaml', settings)
        if scene: private_json(output / 'scene-to-merge.yaml', [scene])
        private_json(output / 'automations-to-merge.yaml', automations)
        print('Generated private files in .local/ha. No HA server or device was changed.')
        print('Merge the optional scene/automation lists; do not replace existing files. See docs/HOME-ASSISTANT.md.')
    except (OSError, ValueError, KeyError, TypeError):
        raise SystemExit('Configuration could not be generated. Check the file, entity IDs and origin. No secret values are printed.')

if __name__ == '__main__': main()
