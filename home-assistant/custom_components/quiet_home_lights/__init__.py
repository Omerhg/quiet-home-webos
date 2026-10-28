"""A local capability endpoint exposing only the configured TV lighting controls."""
import asyncio
import secrets

from aiohttp import web
import voluptuous as vol

from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers import config_validation as cv

from .policy import command_plan, local_address
from .controls_policy import control_plan

DOMAIN = 'quiet_home_lights'
LIGHT = vol.Schema({vol.Required('id'): cv.entity_id, vol.Required('name'): cv.string,
                    vol.Required('room'): vol.In(['Living room', 'Kitchen'])})
CONTROL = vol.Schema({vol.Required('id'): cv.entity_id, vol.Required('name'): cv.string, vol.Required('room'): cv.string})
CONFIG_SCHEMA = vol.Schema({DOMAIN: vol.Schema({vol.Required('token'): cv.string,
                                                vol.Required('lights'): [LIGHT], vol.Optional('controls', default=[]): [CONTROL]})}, extra=vol.ALLOW_EXTRA)


async def async_setup(hass, config):
    settings = config[DOMAIN]
    if len(settings['token']) < 32 or not settings['lights']:
        return False
    if any(item['id'].split('.')[0] not in ['light', 'switch'] for item in settings['lights']):
        return False
    if any(item['id'].split('.')[0] not in ['fan', 'cover', 'media_player'] for item in settings['controls']):
        return False
    hass.http.register_view(LightsView(hass, settings))
    hass.http.register_view(ControlsView(hass, settings))
    return True


class LightsView(HomeAssistantView):
    url = '/api/quiet_home_lights/{capability}'
    name = 'api:quiet_home_lights'
    requires_auth = False
    cors_allowed = True

    def __init__(self, hass, settings):
        self.hass = hass
        self.settings = settings
        self.allowed = {item['id'] for item in settings['lights']}
        self.lock = asyncio.Lock()

    def authorized(self, request, capability):
        return local_address(request.remote or '') and secrets.compare_digest(capability, self.settings['token'])

    def snapshot(self):
        result = []
        for item in self.settings['lights']:
            state = self.hass.states.get(item['id'])
            attrs = state.attributes if state else {}
            modes = attrs.get('supported_color_modes', [])
            brightness = attrs.get('brightness')
            result.append({**item, 'available': bool(state and state.state not in ['unavailable', 'unknown']),
                           'on': bool(state and state.state == 'on'),
                           'brightness': round(brightness / 255 * 100) if isinstance(brightness, (int, float)) else None,
                           'dimmable': any(mode not in ['onoff', 'unknown'] for mode in modes),
                           'color': any(mode in modes for mode in ['xy', 'hs', 'rgb', 'rgbw', 'rgbww']),
                           'warmth': 'color_temp' in modes, 'kelvin': attrs.get('color_temp_kelvin'),
                           'min_kelvin': attrs.get('min_color_temp_kelvin', 2000),
                           'max_kelvin': attrs.get('max_color_temp_kelvin', 6500),
                           'rgb': attrs.get('rgb_color')})
        return {'lights': result}

    async def get(self, request, capability):
        if not self.authorized(request, capability):
            return self.json({'error': 'Not authorized'}, status_code=403)
        return self.json(self.snapshot(), headers={'Cache-Control': 'no-store'})

    async def post(self, request, capability):
        if not self.authorized(request, capability):
            return self.json({'error': 'Not authorized'}, status_code=403)
        if request.content_length is not None and request.content_length > 2048:
            return self.json({'error': 'Invalid light command'}, status_code=400)
        try:
            payload = await request.json()
            plan, unavailable = command_plan(payload, self.allowed,
                                             {entity: self.hass.states.get(entity) for entity in self.allowed})
        except (ValueError, TypeError):
            return self.json({'error': 'Unsupported light command'}, status_code=400)
        try:
            async with self.lock:
                for domain, service, data in plan:
                    await self.hass.services.async_call(domain, service, data, blocking=True, context=self.context(request))
        except Exception:
            return self.json({'error': 'Could not update the light'}, status_code=503)
        return self.json({**self.snapshot(), 'accepted': True, 'unavailable': unavailable}, headers={'Cache-Control': 'no-store'})


class ControlsView(LightsView):
    url = '/api/quiet_home_controls/{capability}'
    name = 'api:quiet_home_controls'

    def __init__(self, hass, settings):
        super().__init__(hass, settings)
        self.allowed = {item['id'] for item in settings['controls']}

    def snapshot(self):
        devices = []
        for item in self.settings['controls']:
            state = self.hass.states.get(item['id'])
            attrs = state.attributes if state else {}
            domain = item['id'].split('.')[0]; features = attrs.get('supported_features', 0)
            actions = []
            if domain == 'fan':
                actions = [name for name, bit in [('speed', 1), ('preset', 8)] if features & bit]
                if features & 16 and features & 32: actions.append('power')
            elif domain == 'cover':
                actions = [name for name, bit in [('open', 1), ('close', 2), ('position', 4), ('stop', 8)] if features & bit]
            elif domain == 'media_player':
                actions = [name for name, bit in [('volume', 4), ('mute', 8)] if features & bit]
            volume = attrs.get('volume_level')
            devices.append({**item, 'kind': domain, 'available': bool(state and state.state not in ['unknown', 'unavailable']),
                            'state': state.state if state else 'unavailable', 'actions': actions,
                            'on': bool(state and state.state == 'on'), 'speed': attrs.get('percentage'),
                            'preset': attrs.get('preset_mode'), 'presets': attrs.get('preset_modes', []),
                            'position': attrs.get('current_position'),
                            'volume': round(volume * 100) if isinstance(volume, (int, float)) else None,
                            'mute': attrs.get('is_volume_muted')})
        return {'devices': devices}

    async def post(self, request, capability):
        if not self.authorized(request, capability):
            return self.json({'error': 'Not authorized'}, status_code=403)
        if request.content_length is not None and request.content_length > 1024:
            return self.json({'error': 'Invalid command'}, status_code=400)
        try:
            payload = await request.json()
            domain, service, data = control_plan(payload, self.allowed,
                                                {entity: self.hass.states.get(entity) for entity in self.allowed})
        except (ValueError, TypeError):
            return self.json({'error': 'Unsupported control command'}, status_code=400)
        try:
            async with self.lock:
                await self.hass.services.async_call(domain, service, data, blocking=True, context=self.context(request))
        except Exception:
            return self.json({'error': 'Could not update device'}, status_code=503)
        return self.json({**self.snapshot(), 'accepted': True}, headers={'Cache-Control': 'no-store'})
