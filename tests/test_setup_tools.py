"""Offline generator/installer checks. No TV, Docker or HA service is contacted."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('generator',ROOT/'scripts/configure_ha.py')
generator=importlib.util.module_from_spec(spec);spec.loader.exec_module(generator)
spec2=importlib.util.spec_from_file_location('installer',ROOT/'scripts/install_ha_connector.py')
installer=importlib.util.module_from_spec(spec2);spec2.loader.exec_module(installer)

class Setup(unittest.TestCase):
    def config(self):return json.loads((ROOT/'config/local.example.json').read_text())
    def test_generator_creates_local_capabilities_and_exact_scene(self):
        config=self.config();settings,scene,automations=generator.generate(config)
        self.assertGreaterEqual(len(settings['token']),32)
        self.assertNotIn('REPLACE_',settings['token'])
        self.assertEqual(scene['entities']['light.tv_light']['brightness'],51)
        self.assertEqual(scene['entities']['light.tv_backlight']['brightness'],204)
        self.assertEqual(scene['entities']['switch.kitchen_sink'],{'state':'off'})
        self.assertTrue(automations[0]['triggers'][0]['local_only'])
        self.assertEqual(generator.generate(config)[0]['token'],settings['token'])
    def test_generator_rejects_nonallowlisted_scene_and_wrong_domains(self):
        config=self.config();config['homeAssistant']['tvTime']['off'].append('switch.unlisted')
        with self.assertRaises(ValueError):generator.generate(config)
        config=self.config();config['homeAssistant']['controls'][0]['id']='lock.front_door'
        with self.assertRaises(ValueError):generator.generate(config)
    def test_private_files_have_private_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            target=Path(directory)/'config.json';target.write_text('{}');target.chmod(0o644)
            generator.private_json(target,{'value':'example'})
            self.assertEqual(target.stat().st_mode&0o777,0o600)
    def test_connector_is_bounded_and_refuses_repeat_install(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);config=root/'configuration.yaml';config.write_text('default_config:\n')
            settings,_,_=generator.generate(self.config())
            payload={'root':str(root),'settings':settings,'files':{'manifest.json':'{}','__init__.py':'# test\n'}}
            def run():return subprocess.run([sys.executable,'-I','-c',installer.STAGE],input=json.dumps(payload),text=True,capture_output=True)
            self.assertEqual(run().returncode,0)
            text=config.read_text();self.assertIn('default_config:',text)
            self.assertEqual(text.count('quiet_home_lights:'),1)
            self.assertEqual((root/'quiet_home_lights.yaml').stat().st_mode&0o777,0o600)
            self.assertNotEqual(run().returncode,0);self.assertEqual(config.read_text(),text)
            self.assertTrue(list((root/'quiet_home_backups').glob('*/configuration.yaml')))

if __name__=='__main__':unittest.main()
