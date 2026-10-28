"""Lighting capability boundary checks; no Home Assistant or devices are changed."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location('policy', Path(__file__).parent / 'custom_components/quiet_home_lights/policy.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class LightingPolicy(unittest.TestCase):
    def setUp(self):
        self.states = {
            'light.tv': SimpleNamespace(state='on', attributes={'supported_color_modes': ['brightness']}),
            'light.back': SimpleNamespace(state='on', attributes={'supported_color_modes': ['xy', 'color_temp'], 'min_color_temp_kelvin': 2000, 'max_color_temp_kelvin': 6535}),
            'switch.sink': SimpleNamespace(state='off', attributes={}),
        }

    def plan(self, ids, action, value, **extra):
        return policy.command_plan(dict(ids=ids, action=action, value=value, **extra), set(self.states), self.states)

    def test_room_power_targets_only_explicit_lights(self):
        plan, unavailable = self.plan(['light.tv', 'switch.sink'], 'power', False)
        self.assertEqual(plan, [('light', 'turn_off', {'entity_id': 'light.tv'}), ('switch', 'turn_off', {'entity_id': 'switch.sink'})])
        self.assertEqual(unavailable, [])

    def test_non_allowlisted_entity_rejects_entire_request(self):
        with self.assertRaises(ValueError): self.plan(['light.tv', 'lock.front_door'], 'power', True)

    def test_service_or_entity_injection_is_rejected(self):
        with self.assertRaises(ValueError): self.plan(['light.tv'], 'power', True, domain='lock')
        with self.assertRaises(ValueError): self.plan(['light.tv'], 'unlock', True)

    def test_power_requires_boolean(self):
        for value in ['off', 0, 1, None]:
            with self.assertRaises(ValueError): self.plan(['switch.sink'], 'power', value)

    def test_brightness_bounds_and_zero(self):
        self.assertEqual(self.plan(['light.tv'], 'brightness', 20)[0][0][2]['brightness_pct'], 20)
        self.assertEqual(self.plan(['light.tv'], 'brightness', 0)[0][0][1], 'turn_off')
        for value in [-1, 101, True, 2.5]:
            with self.assertRaises(ValueError): self.plan(['light.tv'], 'brightness', value)

    def test_sink_cannot_receive_dimming_or_color_commands(self):
        for action, value in [('brightness', 50), ('kelvin', 2700), ('color', [255, 0, 0])]:
            with self.assertRaises(ValueError): self.plan(['switch.sink'], action, value)

    def test_color_capability_is_enforced(self):
        with self.assertRaises(ValueError): self.plan(['light.tv'], 'color', [255, 0, 0])
        self.assertEqual(self.plan(['light.back'], 'color', [255, 120, 40])[0][0][2]['rgb_color'], [255, 120, 40])

    def test_kelvin_capability_and_bounds_are_enforced(self):
        self.assertEqual(self.plan(['light.back'], 'kelvin', 2700)[0][0][2]['color_temp_kelvin'], 2700)
        for value in [1500, 6600]:
            with self.assertRaises(ValueError): self.plan(['light.back'], 'kelvin', value)

    def test_unavailable_light_is_skipped(self):
        self.states['light.tv'].state = 'unavailable'
        plan, unavailable = self.plan(['light.tv', 'switch.sink'], 'power', False)
        self.assertEqual(len(plan), 1); self.assertEqual(unavailable, ['light.tv'])

    def test_duplicate_ids_do_not_repeat_actions(self):
        self.assertEqual(len(self.plan(['light.tv', 'light.tv'], 'power', True)[0]), 1)

    def test_local_network_requirement(self):
        self.assertTrue(policy.local_address('10.23.45.67'))
        self.assertTrue(policy.local_address('127.0.0.1'))
        self.assertFalse(policy.local_address('8.8.8.8'))
        self.assertFalse(policy.local_address('invalid'))


if __name__ == '__main__': unittest.main()
