"""Strict, single-device actions for the Home control center."""

def control_plan(payload, allowed, states):
    if not isinstance(payload, dict) or set(payload) != {'id', 'action', 'value'}:
        raise ValueError('Invalid control command')
    entity, action, value = payload['id'], payload['action'], payload['value']
    if not isinstance(entity, str) or entity not in allowed or not isinstance(action, str):
        raise ValueError('Unknown device')
    state = states.get(entity)
    if not state or state.state in ['unknown', 'unavailable']:
        raise ValueError('Device unavailable')
    domain = entity.split('.')[0]; attrs = state.attributes
    features = attrs.get('supported_features', 0)
    data = {'entity_id': entity}
    if domain == 'fan' and action == 'power' and type(value) is bool:
        service = 'turn_on' if value else 'turn_off'; required = 32 if value else 16
    elif domain == 'fan' and action == 'speed' and type(value) is int and 0 <= value <= 100:
        service = 'set_percentage'; required = 1; data['percentage'] = value
    elif domain == 'fan' and action == 'preset' and isinstance(value, str) and value in attrs.get('preset_modes', []):
        service = 'set_preset_mode'; required = 8; data['preset_mode'] = value
    elif domain == 'cover' and action in ['open', 'close', 'stop'] and value is None:
        service = action + '_cover'; required = {'open': 1, 'close': 2, 'stop': 8}[action]
    elif domain == 'cover' and action == 'position' and type(value) is int and 0 <= value <= 100:
        service = 'set_cover_position'; required = 4; data['position'] = value
    elif domain == 'media_player' and action == 'volume' and type(value) is int and 0 <= value <= 100:
        service = 'volume_set'; required = 4; data['volume_level'] = value / 100
    elif domain == 'media_player' and action == 'mute' and type(value) is bool:
        service = 'volume_mute'; required = 8; data['is_volume_muted'] = value
    else:
        raise ValueError('Unsupported action')
    if not features & required:
        raise ValueError('Unsupported feature')
    return domain, service, data
