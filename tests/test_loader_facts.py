"""Collector boundary checks using synthetic files and a fake CLI only."""
import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import shlex
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
MODULE = runpy.run_path(str(ROOT / 'scripts/collect_loader_facts.py'), run_name='collector_tests')
READER = {}
exec(MODULE['REMOTE_READER'], READER)


class LoaderFactsTests(unittest.TestCase):
    def fixture(self, directory, *, final=False):
        files = {
            'usr/palm/nodejs/unified_service_server.js': 'var servicePath = input_args[3];',
            'usr/palm/services/jsservicelauncher/bootstrap.js': '// synthetic parser',
            'usr/palm/applications/com.webos.app.voiceweb/appinfo.json': '{"id":"fixture-only"}',
            'etc/starfish-release': 'Rockhopper release 11.2.0-3706 (fixture)',
        }
        if final:
            files['usr/palm/nodejs/unified_service_server.js'] += '\nif (!isPathAllowed(service_dir)) {}'
        for name, text in files.items():
            target = Path(directory) / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text)

    def invoke(self, args):
        with patch.object(MODULE['sys'], 'argv', ['collect_loader_facts.py', *args]), contextlib.redirect_stdout(io.StringIO()):
            return MODULE['main']()

    def test_missing_files_are_unknown_and_root_is_never_written(self):
        with tempfile.TemporaryDirectory() as directory:
            result = READER['collect'](directory)
            self.assertEqual(result['candidate'], 'insufficient-evidence')
            self.assertTrue(all(row['status'] == 'missing-in-reader-namespace' for row in result['files'].values()))
            self.assertEqual(list(Path(directory).iterdir()), [])
            self.assertFalse(result['privilegeVerified'])
            self.assertFalse(result['readyForApply'])

    def test_older_markers_are_a_candidate_without_publishing_source(self):
        with tempfile.TemporaryDirectory() as directory:
            self.fixture(directory)
            result = READER['collect'](directory)
            self.assertEqual(result['candidate'], 'older-parser-route-candidate-unverified')
            self.assertGreater(result['files']['unified']['bytes'], 0)
            self.assertEqual(len(result['files']['unified']['sha256']), 64)
            self.assertNotIn('input_args', json.dumps(result))
            self.assertFalse(result['readyForApply'])

    def test_final_path_guard_takes_precedence_over_old_markers(self):
        with tempfile.TemporaryDirectory() as directory:
            self.fixture(directory, final=True)
            result = READER['collect'](directory)
            self.assertEqual(result['candidate'], 'known-path-parser-route-has-final-path-guards')
            self.assertFalse(result['readyForApply'])

    def test_permission_denial_does_not_imply_a_patch(self):
        with patch.object(Path, 'read_bytes', side_effect=PermissionError):
            result = READER['collect']('/fixture')
        self.assertEqual(result['candidate'], 'insufficient-evidence')
        self.assertTrue(all(row['status'] == 'permission-denied' for row in result['files'].values()))

    def test_device_mode_uses_one_fixed_read_command_and_saves_private_ignored_report(self):
        report = READER['collect']('/nonexistent-synthetic-fixture')
        result = SimpleNamespace(stdout='[Info] paired alias\n' + json.dumps(report) + '\n')
        with tempfile.TemporaryDirectory() as directory:
            previous = Path.cwd()
            try:
                os.chdir(directory)
                with patch.object(MODULE['subprocess'], 'run', return_value=result) as runner:
                    self.assertEqual(self.invoke(['--device', 'friend-tv']), 0)
                runner.assert_called_once()
                args = runner.call_args.args[0]
                self.assertTrue(args[0].endswith('node_modules/.bin/ares-novacom'))
                self.assertEqual(args[1:4], ['--device', 'friend-tv', '--run'])
                command = shlex.split(args[4])
                self.assertEqual(command[:2], ['python3', '-c'])
                self.assertEqual(command[2], MODULE['REMOTE_READER'] + '\nprint(json.dumps(collect("/")))\n')
                self.assertNotIn('shell', runner.call_args.kwargs)
                outputs = list(Path('.local/reports').glob('*-loader-facts.json'))
                self.assertEqual(len(outputs), 1)
                self.assertEqual(outputs[0].stat().st_mode & 0o777, 0o600)
                saved = json.loads(outputs[0].read_text())
                self.assertEqual(saved['execution'], 'ordinary-developer-account-reads')
                self.assertFalse(saved['readyForApply'])
            finally:
                os.chdir(previous)

    def test_cli_errors_are_redacted_and_write_no_report(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'report.json'
            error = MODULE['subprocess'].CalledProcessError(1, 'fixture', stderr='DO_NOT_ECHO_CONNECTION_DETAILS')
            stream = io.StringIO()
            with patch.object(MODULE['subprocess'], 'run', side_effect=error), contextlib.redirect_stderr(stream):
                self.assertEqual(self.invoke(['--device', 'friend-tv', '--output', str(output)]), 1)
            self.assertNotIn('DO_NOT_ECHO', stream.getvalue())
            self.assertFalse(output.exists())

    def test_alias_injection_is_rejected_before_cli(self):
        with patch.object(MODULE['subprocess'], 'run') as runner, contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                self.invoke(['--device', 'friend; command'])
            runner.assert_not_called()

    def test_existing_output_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'root'
            root.mkdir()
            output = Path(directory) / 'report.json'
            output.write_text('KEEP THIS REPORT')
            with self.assertRaises(FileExistsError):
                self.invoke(['--from-root', str(root), '--output', str(output)])
            self.assertEqual(output.read_text(), 'KEEP THIS REPORT')
            self.assertEqual(list(root.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
