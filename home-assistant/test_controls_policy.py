"""Control allowlist and feature checks; these tests never contact devices."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
spec=importlib.util.spec_from_file_location('controls_policy',Path(__file__).parent/'custom_components/quiet_home_lights/controls_policy.py')
policy=importlib.util.module_from_spec(spec);spec.loader.exec_module(policy)

class ControlsPolicy(unittest.TestCase):
    def setUp(self):
        self.states={
            'fan.purifier':SimpleNamespace(state='on',attributes={'supported_features':57,'preset_modes':['auto','sleep']}),
            'cover.window':SimpleNamespace(state='open',attributes={'supported_features':15}),
            'media_player.speaker':SimpleNamespace(state='idle',attributes={'supported_features':12}),
        }
    def plan(self,entity,action,value,**extra):
        return policy.control_plan(dict(id=entity,action=action,value=value,**extra),set(self.states),self.states)
    def test_fan(self):
        self.assertEqual(self.plan('fan.purifier','speed',50),('fan','set_percentage',{'entity_id':'fan.purifier','percentage':50}))
        self.assertEqual(self.plan('fan.purifier','power',False)[1],'turn_off')
        self.assertEqual(self.plan('fan.purifier','preset','sleep')[2]['preset_mode'],'sleep')
        with self.assertRaises(ValueError):self.plan('fan.purifier','preset','injected')
    def test_cover(self):
        for action in ['open','close','stop']:self.assertEqual(self.plan('cover.window',action,None)[1],action+'_cover')
        self.assertEqual(self.plan('cover.window','position',65)[2]['position'],65)
        with self.assertRaises(ValueError):self.plan('cover.window','stop',True)
    def test_media(self):
        self.assertEqual(self.plan('media_player.speaker','volume',25)[2]['volume_level'],.25)
        self.assertEqual(self.plan('media_player.speaker','mute',True)[2]['is_volume_muted'],True)
    def test_injection(self):
        for entity,action,value in [('lock.front_door','power',False),('fan.purifier','unlock',True),('cover.window','volume',50),('media_player.speaker','power',True)]:
            with self.assertRaises(ValueError):self.plan(entity,action,value)
        with self.assertRaises(ValueError):self.plan('fan.purifier','speed',50,service='reboot')
    def test_range_and_types(self):
        for entity,action in [('fan.purifier','speed'),('cover.window','position'),('media_player.speaker','volume')]:
            for value in [-1,101,True,'50',50.1,None]:
                with self.assertRaises(ValueError):self.plan(entity,action,value)
        with self.assertRaises(ValueError):self.plan('media_player.speaker','mute',1)
    def test_unsupported_and_offline(self):
        self.states['cover.window'].attributes['supported_features']=1
        with self.assertRaises(ValueError):self.plan('cover.window','position',40)
        self.states['fan.purifier'].state='unavailable'
        with self.assertRaises(ValueError):self.plan('fan.purifier','power',True)

if __name__=='__main__':unittest.main()
