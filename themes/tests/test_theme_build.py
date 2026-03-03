from __future__ import annotations

import contextlib
import io
from pathlib import Path
import sys
import tempfile
import textwrap
import unittest

DOTFILES_ROOT = Path(__file__).resolve().parents[2]
THEME_SCRIPTS_DIR = DOTFILES_ROOT / "themes" / "scripts"
if str(THEME_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(THEME_SCRIPTS_DIR))

import theme_build


VALID_THEME_TOML = textwrap.dedent(
    """
    schema_version = 1

    [theme]
    id = "sample-theme"
    name = "Sample Theme"
    variant = "night"
    source = "https://example.com/sample-theme"

    [identifiers]
    ghostty = "Sample"
    nvim_colorscheme = "sample-theme"
    antigravity = "Sample Theme"
    opencode = "sample-theme"
    obsidian = "Sample Theme"

    [palette]
    bg0 = "#1a1b26"
    bg1 = "#24283b"
    bg2 = "#414868"
    fg = "#c0caf5"
    grey = "#565f89"
    red = "#f7768e"
    orange = "#ff9e64"
    yellow = "#e0af68"
    green = "#9ece6a"
    cyan = "#7dcfff"
    blue = "#7aa2f7"
    magenta = "#bb9af7"

    [overrides.neovim]
    contrast = "soft"
    """
).strip()


class ThemeBuildTests(unittest.TestCase):
    def test_load_theme_sources_returns_sorted_ids_for_migrated_themes(self) -> None:
        theme_sources = theme_build.load_theme_sources(DOTFILES_ROOT / "themes" / "sources")
        ids = [theme_source.theme.id for theme_source in theme_sources]
        self.assertEqual(ids, sorted(ids))
        self.assertEqual(ids, ["everforest", "gruvbox", "osaka-jade", "tokyo-night"])

    def test_load_theme_source_normalizes_hex_to_lowercase(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(
                VALID_THEME_TOML.replace("#1a1b26", "#1A1B26").replace("#7aa2f7", "#7AA2F7"),
                encoding="utf-8",
            )
            loaded = theme_build.load_theme_source(source_file)
            self.assertEqual(loaded.palette.bg0, "#1a1b26")
            self.assertEqual(loaded.palette.blue, "#7aa2f7")

    def test_rejects_filename_theme_id_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "wrong-name.toml"
            source_file.write_text(VALID_THEME_TOML, encoding="utf-8")
            with self.assertRaises(theme_build.ThemeSourceError) as caught:
                theme_build.load_theme_source(source_file)
        self.assertIn("must match filename id", str(caught.exception))

    def test_rejects_unknown_top_level_key(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(
                VALID_THEME_TOML.replace("schema_version = 1", "schema_version = 1\nextra_key = true"),
                encoding="utf-8",
            )
            with self.assertRaises(theme_build.ThemeSourceError) as caught:
                theme_build.load_theme_source(source_file)
        self.assertIn("Unknown key(s) in top-level", str(caught.exception))

    def test_rejects_invalid_palette_color(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(VALID_THEME_TOML.replace("#9ece6a", "9ece6a"), encoding="utf-8")
            with self.assertRaises(theme_build.ThemeSourceError) as caught:
                theme_build.load_theme_source(source_file)
        self.assertIn("palette.green must match #RRGGBB", str(caught.exception))

    def test_rejects_unknown_override_target(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(
                VALID_THEME_TOML.replace("[overrides.neovim]", "[overrides.unknown_target]"),
                encoding="utf-8",
            )
            with self.assertRaises(theme_build.ThemeSourceError) as caught:
                theme_build.load_theme_source(source_file)
        self.assertIn("is not supported", str(caught.exception))

    def test_validate_theme_sources_collects_issues_across_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            invalid_color_file = temp_path / "sample-theme.toml"
            invalid_color_file.write_text(
                VALID_THEME_TOML.replace("#9ece6a", "9ece6a"),
                encoding="utf-8",
            )

            missing_key_file = temp_path / "second-theme.toml"
            missing_key_file.write_text(
                VALID_THEME_TOML.replace('id = "sample-theme"', 'id = "second-theme"').replace(
                    'obsidian = "Sample Theme"\n',
                    "",
                ),
                encoding="utf-8",
            )

            report = theme_build.validate_theme_sources(temp_path)

        self.assertFalse(report.is_valid)
        self.assertEqual(report.checked_files, 2)
        self.assertEqual(len(report.issues), 2)
        messages = [issue.format() for issue in report.issues]
        self.assertTrue(any("palette.green must match #RRGGBB" in message for message in messages))
        self.assertTrue(
            any("Missing required key(s) in identifiers: obsidian" in message for message in messages)
        )

    def test_run_check_mode_returns_zero_when_sources_are_valid(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(VALID_THEME_TOML, encoding="utf-8")
            output = io.StringIO()
            exit_code = theme_build.run_check_mode(temp_dir, output=output)

        self.assertEqual(exit_code, 0)
        self.assertIn("theme-build check: OK", output.getvalue())

    def test_main_check_mode_returns_non_zero_with_diagnostics(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(VALID_THEME_TOML.replace("#9ece6a", "9ece6a"), encoding="utf-8")

            captured_output = io.StringIO()
            with contextlib.redirect_stdout(captured_output):
                exit_code = theme_build.main(["--check", "--sources-dir", temp_dir])

        self.assertEqual(exit_code, 1)
        output = captured_output.getvalue()
        self.assertIn("theme-build check: FAIL", output)
        self.assertIn("palette.green must match #RRGGBB", output)
        self.assertIn(str(source_file.resolve()), output)


if __name__ == "__main__":
    unittest.main()
