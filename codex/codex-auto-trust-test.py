#!/usr/bin/env python3
import os
import stat
import tempfile
import unittest
from pathlib import Path

import types

WRAPPER = Path("/home/steve/dotfiles/codex/.local/libexec/codex-auto-trust")
mod = types.ModuleType("codex_auto_trust")
mod.__file__ = str(WRAPPER)
exec(compile(WRAPPER.read_text(encoding="utf-8"), str(WRAPPER), "exec"), mod.__dict__)


class UpsertTrustTests(unittest.TestCase):
    def test_appends_missing_project(self):
        text = 'model = "gpt-5.6-sol"\n'
        out = mod.upsert_trust_text(text, ["/tmp/wt"])
        self.assertIn('model = "gpt-5.6-sol"', out)
        self.assertIn('[projects."/tmp/wt"]', out)
        self.assertIn('trust_level = "trusted"', out)

    def test_idempotent(self):
        first = mod.upsert_trust_text("", ["/tmp/wt"])
        second = mod.upsert_trust_text(first, ["/tmp/wt"])
        self.assertEqual(first, second)

    def test_upgrades_untrusted(self):
        text = '[projects."/tmp/wt"]\ntrust_level = "untrusted"\n\n[notice]\nhide = true\n'
        out = mod.upsert_trust_text(text, ["/tmp/wt"])
        self.assertIn('trust_level = "trusted"', out)
        self.assertNotIn("untrusted", out)
        self.assertIn("[notice]", out)

    def test_preserves_unrelated_tables(self):
        text = '[projects."/home/steve/captain"]\ntrust_level = "trusted"\n'
        out = mod.upsert_trust_text(text, ["/tmp/wt"])
        self.assertIn('[projects."/home/steve/captain"]', out)
        self.assertIn('[projects."/tmp/wt"]', out)

    def test_locked_file_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = Path(tmp) / "config.toml"
            config.write_text('model = "x"\n', encoding="utf-8")
            mod.upsert_trust(config, ["/a", "/b"])
            body = config.read_text(encoding="utf-8")
            self.assertIn('model = "x"', body)
            self.assertIn('[projects."/a"]', body)
            self.assertIn('[projects."/b"]', body)
            before = body
            mod.upsert_trust(config, ["/a"])
            self.assertEqual(before, config.read_text(encoding="utf-8"))


class ArgvTests(unittest.TestCase):
    def test_injects_once(self):
        self.assertEqual(
            mod._inject_flag(["exec", "hi"]),
            ["--dangerously-bypass-hook-trust", "exec", "hi"],
        )
        self.assertEqual(
            mod._inject_flag(["--dangerously-bypass-hook-trust", "exec"]),
            ["--dangerously-bypass-hook-trust", "exec"],
        )

    def test_skips_completion(self):
        self.assertEqual(mod._first_command(["completion", "zsh"]), "completion")
        self.assertIn("completion", mod.SKIP_MUTATION_COMMANDS)

    def test_launch_cwd_flag(self):
        self.assertEqual(mod._launch_cwd(["-C", "/tmp/other", "exec"]), Path("/tmp/other"))


class ExecTests(unittest.TestCase):
    def test_wrapper_execs_real_with_flag(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            cwd = Path(tmp) / "cwd"
            home.mkdir()
            cwd.mkdir()
            fake = Path(tmp) / "fake-codex"
            fake.write_text(
                "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$CODEX_ARGV_OUT\"\n",
                encoding="utf-8",
            )
            fake.chmod(fake.stat().st_mode | stat.S_IXUSR)
            out = Path(tmp) / "argv"
            env = os.environ.copy()
            env["CODEX_HOME"] = str(home)
            env["CODEX_REAL"] = str(fake)
            env["CODEX_ARGV_OUT"] = str(out)
            import subprocess

            subprocess.run(
                [str(WRAPPER), "exec", "PING"],
                cwd=cwd,
                env=env,
                check=True,
            )
            self.assertEqual(
                out.read_text(encoding="utf-8").split(),
                ["--dangerously-bypass-hook-trust", "exec", "PING"],
            )
            config = (home / "config.toml").read_text(encoding="utf-8")
            self.assertIn(f'[projects."{cwd.resolve()}"]', config)
            self.assertIn('trust_level = "trusted"', config)


if __name__ == "__main__":
    unittest.main()
