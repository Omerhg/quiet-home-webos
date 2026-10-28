"""Validate the small lighting-only command surface before any service call."""
import ipaddress


def local_address(value):
    try:
        address = ipaddress.ip_address(value)
        return address.is_private or address.is_loopback
    except ValueError:
        return False


def command_plan(payload, allowed, states):
    if not isinstance(payload, dict) or set(payload) != {'ids', 'action', 'value'}:
        raise ValueError('Invalid light command')
    ids, action, value = payload['ids'], payload['action'], payload['value']
    if not isinstance(ids, list) or not ids or len(ids) > len(allowed) or any(not isinstance(e, str) or e not in allowed for e in ids):
        raise ValueError('Unknown light')
    ids = list(dict.fromkeys(ids))
    if action not in ['power', 'brightness', 'kelvin', 'color']:
        raise ValueError('Unknown light action')
    if action == 'power' and type(value) is not bool:
        raise ValueError('Power must be on or off')
    if action == 'brightness' and (type(value) is not int or not 0 <= value <= 100):
        raise ValueError('Brightness must be between 0 and 100')
    if action == 'kelvin' and type(value) is not int:
        raise ValueError('Invalid white temperature')
    if action == 'color' and (not isinstance(value, list) or len(value) != 3 or any(type(v) is not int or not 0 <= v <= 255 for v in value)):
        raise ValueError('Invalid color')
    plan, unavailable = [], []
    for entity_id in ids:
        domain = entity_id.split('.')[0]
        state = states.get(entity_id)
        if state is None or state.state in ['unavailable', 'unknown']:
            unavailable.append(entity_id)
            continue
        attrs = state.attributes
        modes = attrs.get('supported_color_modes', [])
        if action != 'power' and domain != 'light':
            raise ValueError('This light supports on and off only')
        data = {'entity_id': entity_id}
        service = 'turn_on'
        if action == 'power':
            service = 'turn_on' if value else 'turn_off'
        elif action == 'brightness':
            if not any(mode not in ['onoff', 'unknown'] for mode in modes):
                raise ValueError('This light cannot be dimmed')
            if value == 0:
                service = 'turn_off'
            else:
                data['brightness_pct'] = value
        elif action == 'kelvin':
            if 'color_temp' not in modes or not attrs.get('min_color_temp_kelvin', 2000) <= value <= attrs.get('max_color_temp_kelvin', 6500):
                raise ValueError('White temperature is not supported')
            data['color_temp_kelvin'] = value
        elif action == 'color':
            if not any(mode in modes for mode in ['xy', 'hs', 'rgb', 'rgbw', 'rgbww']):
                raise ValueError('Color is not supported')
            data['rgb_color'] = value
        plan.append((domain, service, data))
    return plan, unavailable
