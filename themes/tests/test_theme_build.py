from __future__ import annotations

import contextlib
import io
import json
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
    nvim_plugin = "author/sample.nvim"
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

    def test_render_theme_meta_env_uses_stable_field_order(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(VALID_THEME_TOML, encoding="utf-8")
            theme_source = theme_build.load_theme_source(source_file)

        rendered = theme_build.render_theme_meta_env(theme_source)

        expected_lines = [
            "# Sample Theme Theme Metadata",
            "# Generated from canonical TOML source. Do not edit manually.",
            '# Canonical source: https://example.com/sample-theme',
            "",
            'THEME_NAME="Sample Theme"',
            'THEME_VARIANT="night"',
            "",
            "# App-specific theme identifiers",
            'GHOSTTY_THEME="Sample"',
            'NVIM_COLORSCHEME="sample-theme"',
            'NVIM_PLUGIN="author/sample.nvim"',
            'ANTIGRAVITY_THEME="Sample Theme"',
            'OPENCODE_THEME="sample-theme"',
            'OBSIDIAN_THEME="Sample Theme"',
            "",
            "# Core palette (canonical #RRGGBB format)",
            'BG_COLOR="#1a1b26"',
            'BG_HIGHLIGHT="#24283b"',
            'FG_COLOR="#c0caf5"',
            'RED="#f7768e"',
            'ORANGE="#ff9e64"',
            'YELLOW="#e0af68"',
            'GREEN="#9ece6a"',
            'AQUA="#7dcfff"',
            'CYAN="#7dcfff"',
            'BLUE="#7aa2f7"',
            'MAGENTA="#bb9af7"',
            'COMMENT="#565f89"',
            'BLACK="#414868"',
            "",
        ]
        self.assertEqual(rendered, "\n".join(expected_lines))

    def test_generate_theme_meta_files_writes_and_prunes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            sources_dir = root / "sources"
            meta_dir = root / "meta"
            sources_dir.mkdir()
            meta_dir.mkdir()

            (sources_dir / "sample-theme.toml").write_text(VALID_THEME_TOML, encoding="utf-8")
            stale_file = meta_dir / "stale-theme.env"
            stale_file.write_text("stale=true\n", encoding="utf-8")

            written_files = theme_build.generate_theme_meta_files(sources_dir=sources_dir, meta_dir=meta_dir)

            self.assertEqual([path.name for path in written_files], ["sample-theme.env"])
            self.assertFalse(stale_file.exists())
            generated = (meta_dir / "sample-theme.env").read_text(encoding="utf-8")
            self.assertIn('THEME_NAME="Sample Theme"', generated)
            self.assertIn('BG_HIGHLIGHT="#24283b"', generated)

    def test_main_generate_meta_mode_writes_env_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            sources_dir = root / "sources"
            meta_dir = root / "meta"
            sources_dir.mkdir()
            (sources_dir / "sample-theme.toml").write_text(VALID_THEME_TOML, encoding="utf-8")

            captured_output = io.StringIO()
            with contextlib.redirect_stdout(captured_output):
                exit_code = theme_build.main(
                    [
                        "--generate-meta",
                        "--sources-dir",
                        str(sources_dir),
                        "--meta-dir",
                        str(meta_dir),
                    ]
                )

            self.assertEqual(exit_code, 0)
            self.assertIn("theme-build generate-meta: OK", captured_output.getvalue())
            self.assertTrue((meta_dir / "sample-theme.env").exists())

    def test_render_themes_manifest_uses_stable_theme_and_color_order(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            first_source = root / "z-theme.toml"
            second_source = root / "a-theme.toml"
            first_source.write_text(
                VALID_THEME_TOML.replace('id = "sample-theme"', 'id = "z-theme"').replace(
                    'name = "Sample Theme"',
                    'name = "Z Theme"',
                ),
                encoding="utf-8",
            )
            second_source.write_text(
                VALID_THEME_TOML.replace('id = "sample-theme"', 'id = "a-theme"').replace(
                    'name = "Sample Theme"',
                    'name = "A Theme"',
                ),
                encoding="utf-8",
            )
            theme_sources = [
                theme_build.load_theme_source(first_source),
                theme_build.load_theme_source(second_source),
            ]

        rendered = theme_build.render_themes_manifest(theme_sources)
        manifest = json.loads(rendered)
        self.assertEqual([theme["id"] for theme in manifest["themes"]], ["a-theme", "z-theme"])

        color_keys = list(manifest["themes"][0]["colors"].keys())
        self.assertEqual(color_keys, list(theme_build.THEME_JSON_COLOR_KEYS))

    def test_generate_themes_manifest_file_writes_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            sources_dir = root / "sources"
            manifest_path = root / "generated" / "themes.json"
            sources_dir.mkdir()
            (sources_dir / "sample-theme.toml").write_text(VALID_THEME_TOML, encoding="utf-8")

            written_path = theme_build.generate_themes_manifest_file(
                sources_dir=sources_dir,
                themes_json_path=manifest_path,
            )

            self.assertEqual(written_path, manifest_path.resolve())
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(len(manifest["themes"]), 1)
            self.assertEqual(manifest["themes"][0]["id"], "sample-theme")
            self.assertEqual(manifest["themes"][0]["colors"]["bg0"], "#1a1b26")

    def test_main_generate_themes_json_mode_writes_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            sources_dir = root / "sources"
            manifest_path = root / "themes.json"
            sources_dir.mkdir()
            (sources_dir / "sample-theme.toml").write_text(VALID_THEME_TOML, encoding="utf-8")

            captured_output = io.StringIO()
            with contextlib.redirect_stdout(captured_output):
                exit_code = theme_build.main(
                    [
                        "--generate-themes-json",
                        "--sources-dir",
                        str(sources_dir),
                        "--themes-json-path",
                        str(manifest_path),
                    ]
                )

            self.assertEqual(exit_code, 0)
            self.assertIn("theme-build generate-themes-json: OK", captured_output.getvalue())
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(manifest["themes"][0]["name"], "Sample Theme")

    def test_render_theme_meta_env_files_match_repo_artifacts(self) -> None:
        sources_dir = DOTFILES_ROOT / "themes" / "sources"
        meta_dir = DOTFILES_ROOT / "themes" / "meta"
        theme_sources = theme_build.load_theme_sources(sources_dir)

        self.assertEqual(
            sorted(path.stem for path in meta_dir.glob("*.env")),
            [theme_source.theme.id for theme_source in theme_sources],
        )
        for theme_source in theme_sources:
            artifact_path = meta_dir / f"{theme_source.theme.id}.env"
            self.assertTrue(artifact_path.exists(), f"missing artifact {artifact_path}")
            self.assertEqual(
                artifact_path.read_text(encoding="utf-8"),
                theme_build.render_theme_meta_env(theme_source),
                f"artifact mismatch: {artifact_path}",
            )

    def test_render_themes_manifest_matches_repo_artifact(self) -> None:
        sources_dir = DOTFILES_ROOT / "themes" / "sources"
        manifest_path = DOTFILES_ROOT / "themes" / "themes.json"

        self.assertTrue(manifest_path.exists(), f"missing artifact {manifest_path}")
        theme_sources = theme_build.load_theme_sources(sources_dir)
        self.assertEqual(
            manifest_path.read_text(encoding="utf-8"),
            theme_build.render_themes_manifest(theme_sources),
        )

    def test_render_solid_wallpaper_png_uses_bg0_and_default_dimensions(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(VALID_THEME_TOML, encoding="utf-8")
            theme_source = theme_build.load_theme_source(source_file)

        rendered = theme_build.render_solid_wallpaper_png(theme_source)
        self.assertEqual(rendered[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(rendered[12:16], b"IHDR")
        self.assertEqual(
            int.from_bytes(rendered[16:20], "big"),
            theme_build.DEFAULT_WALLPAPER_WIDTH,
        )
        self.assertEqual(
            int.from_bytes(rendered[20:24], "big"),
            theme_build.DEFAULT_WALLPAPER_HEIGHT,
        )
        self.assertEqual(rendered, theme_build.render_solid_wallpaper_png(theme_source))

    def test_generate_theme_wallpaper_files_writes_and_prunes_managed_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            sources_dir = root / "sources"
            wallpapers_dir = root / "wallpapers"
            sources_dir.mkdir()
            wallpapers_dir.mkdir()

            source_file = sources_dir / "sample-theme.toml"
            source_file.write_text(VALID_THEME_TOML, encoding="utf-8")
            theme_source = theme_build.load_theme_source(source_file)

            stale_theme_dir = wallpapers_dir / "stale-theme"
            stale_theme_dir.mkdir()
            stale_file = stale_theme_dir / theme_build.MANAGED_WALLPAPER_FILENAME
            stale_file.write_bytes(b"stale")
            additional_file = stale_theme_dir / "2-custom.jpg"
            additional_file.write_bytes(b"keep")

            written_files = theme_build.generate_theme_wallpaper_files(
                sources_dir=sources_dir,
                wallpapers_dir=wallpapers_dir,
            )
            resolved_wallpapers_dir = wallpapers_dir.resolve()

            self.assertEqual(
                [path.relative_to(resolved_wallpapers_dir).as_posix() for path in written_files],
                ["sample-theme/1-solid.png"],
            )
            self.assertFalse(stale_file.exists())
            self.assertTrue(additional_file.exists())
            generated_file = wallpapers_dir / "sample-theme" / theme_build.MANAGED_WALLPAPER_FILENAME
            self.assertEqual(generated_file.read_bytes(), theme_build.render_solid_wallpaper_png(theme_source))

    def test_main_generate_wallpapers_mode_writes_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            sources_dir = root / "sources"
            wallpapers_dir = root / "wallpapers"
            sources_dir.mkdir()
            (sources_dir / "sample-theme.toml").write_text(VALID_THEME_TOML, encoding="utf-8")

            captured_output = io.StringIO()
            with contextlib.redirect_stdout(captured_output):
                exit_code = theme_build.main(
                    [
                        "--generate-wallpapers",
                        "--sources-dir",
                        str(sources_dir),
                        "--wallpapers-dir",
                        str(wallpapers_dir),
                    ]
                )

            self.assertEqual(exit_code, 0)
            self.assertIn("theme-build generate-wallpapers: OK", captured_output.getvalue())
            self.assertTrue((wallpapers_dir / "sample-theme" / "1-solid.png").exists())

    def test_generate_theme_config_files_writes_and_prunes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            sources_dir = root / "sources"
            configs_dir = root / "configs"
            sources_dir.mkdir()
            configs_dir.mkdir()

            (sources_dir / "sample-theme.toml").write_text(VALID_THEME_TOML, encoding="utf-8")
            stale_file = configs_dir / "stale-theme" / "tmux.conf"
            stale_file.parent.mkdir()
            stale_file.write_text("stale=true\n", encoding="utf-8")

            written_files = theme_build.generate_theme_config_files(
                sources_dir=sources_dir,
                configs_dir=configs_dir,
            )

            expected_files = [
                "bordersrc",
                "ghostty.conf",
                "neovim.lua",
                "obsidian-snippet.css",
                "sketchybar-colors.lua",
                "tmux.conf",
            ]
            self.assertEqual(
                sorted(path.name for path in written_files),
                expected_files,
            )
            self.assertFalse(stale_file.exists())

            tmux_contents = (configs_dir / "sample-theme" / "tmux.conf").read_text(encoding="utf-8")
            self.assertIn('set -g @thm_bg "#24283b"', tmux_contents)
            self.assertIn('set -g @thm_teal "#7dcfff"', tmux_contents)

    def test_main_generate_configs_mode_writes_configs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            sources_dir = root / "sources"
            configs_dir = root / "configs"
            sources_dir.mkdir()
            (sources_dir / "sample-theme.toml").write_text(VALID_THEME_TOML, encoding="utf-8")

            captured_output = io.StringIO()
            with contextlib.redirect_stdout(captured_output):
                exit_code = theme_build.main(
                    [
                        "--generate-configs",
                        "--sources-dir",
                        str(sources_dir),
                        "--configs-dir",
                        str(configs_dir),
                    ]
                )

            self.assertEqual(exit_code, 0)
            self.assertIn("theme-build generate-configs: OK", captured_output.getvalue())
            self.assertTrue((configs_dir / "sample-theme" / "sketchybar-colors.lua").exists())
            self.assertTrue((configs_dir / "sample-theme" / "bordersrc").exists())
            self.assertTrue((configs_dir / "sample-theme" / "tmux.conf").exists())
            self.assertTrue((configs_dir / "sample-theme" / "ghostty.conf").exists())
            self.assertTrue((configs_dir / "sample-theme" / "neovim.lua").exists())
            self.assertTrue((configs_dir / "sample-theme" / "obsidian-snippet.css").exists())

    def test_render_neovim_config_applies_plugin_overrides(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(VALID_THEME_TOML, encoding="utf-8")
            theme_source = theme_build.load_theme_source(source_file)

        rendered = theme_build.render_neovim_config(theme_source)

        self.assertIn('"author/sample.nvim"', rendered)
        self.assertIn('require("sample").setup({', rendered)
        self.assertIn('contrast = "soft"', rendered)
        self.assertIn('colorscheme = "sample-theme"', rendered)

    def test_render_obsidian_snippet_applies_overrides(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(
                VALID_THEME_TOML
                + textwrap.dedent(
                    """

                    [overrides.obsidian]
                    variable_prefix = "sample"
                    editor_color = "#414868"
                    active_file_accent = "#ff9e64"
                    active_file_alpha = 0.2
                    """
                ),
                encoding="utf-8",
            )
            theme_source = theme_build.load_theme_source(source_file)

        rendered = theme_build.render_obsidian_snippet(theme_source)

        self.assertIn("--sample-editor: #414868;", rendered)
        self.assertIn("--sample-accent: #ff9e64;", rendered)
        self.assertIn("background-color: rgba(255, 158, 100, 0.2) !important;", rendered)

    def test_render_neovim_config_rejects_unknown_override_keys(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_file = Path(temp_dir) / "sample-theme.toml"
            source_file.write_text(
                VALID_THEME_TOML.replace('contrast = "soft"', 'unknown_key = "value"'),
                encoding="utf-8",
            )
            theme_source = theme_build.load_theme_source(source_file)

            with self.assertRaises(theme_build.ThemeSourceError) as caught:
                theme_build.render_neovim_config(theme_source)

        self.assertIn("Unknown key(s) in overrides.neovim", str(caught.exception))

    def test_render_app_configs_match_repo_artifacts(self) -> None:
        sources_dir = DOTFILES_ROOT / "themes" / "sources"
        configs_dir = DOTFILES_ROOT / "themes" / "configs"
        theme_sources = theme_build.load_theme_sources(sources_dir)

        for theme_source in theme_sources:
            rendered = theme_build.render_theme_app_configs(theme_source)
            theme_dir = configs_dir / theme_source.theme.id
            for filename, expected_content in rendered.items():
                artifact_path = theme_dir / filename
                self.assertTrue(artifact_path.exists(), f"missing artifact {artifact_path}")
                actual_content = artifact_path.read_text(encoding="utf-8")
                self.assertEqual(actual_content, expected_content, f"artifact mismatch: {artifact_path}")

    def test_render_solid_wallpapers_match_repo_artifacts(self) -> None:
        sources_dir = DOTFILES_ROOT / "themes" / "sources"
        wallpapers_dir = DOTFILES_ROOT / "themes" / "wallpapers"
        theme_sources = theme_build.load_theme_sources(sources_dir)

        for theme_source in theme_sources:
            artifact_path = wallpapers_dir / theme_source.theme.id / theme_build.MANAGED_WALLPAPER_FILENAME
            self.assertTrue(artifact_path.exists(), f"missing artifact {artifact_path}")
            self.assertEqual(
                artifact_path.read_bytes(),
                theme_build.render_solid_wallpaper_png(theme_source),
                f"artifact mismatch: {artifact_path}",
            )

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
