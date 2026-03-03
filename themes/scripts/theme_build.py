#!/usr/bin/env python3
"""Core loader/model for canonical theme TOML sources."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
from pathlib import Path
import re
import struct
import sys
import tomllib
from typing import Any, Mapping, Sequence, TextIO
import zlib

THEME_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")
CSS_IDENTIFIER_PATTERN = re.compile(r"^[a-z0-9_-]+$")

REQUIRED_THEME_KEYS = ("id", "name", "variant", "source")
REQUIRED_IDENTIFIER_KEYS = (
    "ghostty",
    "nvim_colorscheme",
    "antigravity",
    "opencode",
    "obsidian",
)
OPTIONAL_IDENTIFIER_KEYS = ("nvim_plugin",)
REQUIRED_PALETTE_KEYS = (
    "bg0",
    "bg1",
    "bg2",
    "fg",
    "grey",
    "red",
    "orange",
    "yellow",
    "green",
    "cyan",
    "blue",
    "magenta",
)
THEME_JSON_COLOR_KEYS = (
    "bg0",
    "bg1",
    "bg2",
    "fg",
    "grey",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "orange",
)
MANAGED_THEME_CONFIG_FILENAMES = (
    "sketchybar-colors.lua",
    "bordersrc",
    "tmux.conf",
    "ghostty.conf",
    "neovim.lua",
    "obsidian-snippet.css",
)
MANAGED_WALLPAPER_FILENAME = "1-solid.png"
DEFAULT_WALLPAPER_WIDTH = 5120
DEFAULT_WALLPAPER_HEIGHT = 2880

ALLOWED_TOP_LEVEL_KEYS = {"schema_version", "theme", "identifiers", "palette", "overrides"}
ALLOWED_OVERRIDE_TARGETS = {
    "neovim",
    "ghostty",
    "obsidian",
    "sketchybar",
    "borders",
    "tmux",
    "wallpaper",
    "antigravity",
    "opencode",
    "opencode_theme",
}


class ThemeSourceError(ValueError):
    """Raised when a source TOML file fails schema validation."""

    def __init__(self, source_file: Path, message: str):
        self.source_file = source_file
        super().__init__(f"{source_file}: {message}")


@dataclass(frozen=True, slots=True)
class ThemeMeta:
    id: str
    name: str
    variant: str
    source: str


@dataclass(frozen=True, slots=True)
class ThemeIdentifiers:
    ghostty: str
    nvim_colorscheme: str
    antigravity: str
    opencode: str
    obsidian: str
    nvim_plugin: str | None = None


@dataclass(frozen=True, slots=True)
class ThemePalette:
    bg0: str
    bg1: str
    bg2: str
    fg: str
    grey: str
    red: str
    orange: str
    yellow: str
    green: str
    cyan: str
    blue: str
    magenta: str


@dataclass(frozen=True, slots=True)
class ThemeSource:
    schema_version: int
    file_path: Path
    theme: ThemeMeta
    identifiers: ThemeIdentifiers
    palette: ThemePalette
    overrides: dict[str, dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        """Return a normalized dictionary form for deterministic serialization."""
        data: dict[str, Any] = {
            "schema_version": self.schema_version,
            "theme": {
                "id": self.theme.id,
                "name": self.theme.name,
                "variant": self.theme.variant,
                "source": self.theme.source,
            },
            "identifiers": {
                "ghostty": self.identifiers.ghostty,
                "nvim_colorscheme": self.identifiers.nvim_colorscheme,
                "antigravity": self.identifiers.antigravity,
                "opencode": self.identifiers.opencode,
                "obsidian": self.identifiers.obsidian,
            },
            "palette": {
                "bg0": self.palette.bg0,
                "bg1": self.palette.bg1,
                "bg2": self.palette.bg2,
                "fg": self.palette.fg,
                "grey": self.palette.grey,
                "red": self.palette.red,
                "orange": self.palette.orange,
                "yellow": self.palette.yellow,
                "green": self.palette.green,
                "cyan": self.palette.cyan,
                "blue": self.palette.blue,
                "magenta": self.palette.magenta,
            },
            "overrides": self.overrides,
            "file_path": str(self.file_path),
        }
        if self.identifiers.nvim_plugin is not None:
            data["identifiers"]["nvim_plugin"] = self.identifiers.nvim_plugin
        return data


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    source_file: Path
    message: str

    def format(self) -> str:
        return f"{self.source_file}: {self.message}"


@dataclass(frozen=True, slots=True)
class ValidationReport:
    sources_dir: Path
    checked_files: int
    valid_files: int
    issues: tuple[ValidationIssue, ...]

    @property
    def is_valid(self) -> bool:
        return not self.issues


def default_sources_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "sources"


def default_meta_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "meta"


def default_configs_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "configs"


def default_wallpapers_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "wallpapers"


def default_themes_json_path() -> Path:
    return Path(__file__).resolve().parent.parent / "themes.json"


def load_theme_source(source_file: str | Path) -> ThemeSource:
    path = Path(source_file).resolve()
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ThemeSourceError(path, "File not found") from error
    except tomllib.TOMLDecodeError as error:
        raise ThemeSourceError(path, f"TOML parse error: {error}") from error

    if not isinstance(raw, dict):
        raise ThemeSourceError(path, "Expected top-level TOML table")
    _ensure_known_keys(path, "top-level", raw, ALLOWED_TOP_LEVEL_KEYS)

    schema_version = raw.get("schema_version")
    if not isinstance(schema_version, int):
        raise ThemeSourceError(path, "schema_version must be an integer")
    if schema_version != 1:
        raise ThemeSourceError(path, f"Unsupported schema_version {schema_version}; expected 1")

    theme_raw = _require_table(path, raw, "theme")
    _ensure_required_keys(path, "theme", theme_raw, REQUIRED_THEME_KEYS)
    _ensure_known_keys(path, "theme", theme_raw, set(REQUIRED_THEME_KEYS))

    theme_id = _normalize_theme_id(path, "theme.id", theme_raw["id"])
    filename_id = path.stem
    if theme_id != filename_id:
        raise ThemeSourceError(
            path,
            f"theme.id '{theme_id}' must match filename id '{filename_id}'",
        )

    theme = ThemeMeta(
        id=theme_id,
        name=_normalize_required_string(path, "theme.name", theme_raw["name"]),
        variant=_normalize_required_string(path, "theme.variant", theme_raw["variant"]),
        source=_normalize_required_string(path, "theme.source", theme_raw["source"]),
    )

    identifiers_raw = _require_table(path, raw, "identifiers")
    _ensure_required_keys(path, "identifiers", identifiers_raw, REQUIRED_IDENTIFIER_KEYS)
    _ensure_known_keys(
        path,
        "identifiers",
        identifiers_raw,
        set(REQUIRED_IDENTIFIER_KEYS).union(OPTIONAL_IDENTIFIER_KEYS),
    )

    nvim_plugin: str | None = None
    if "nvim_plugin" in identifiers_raw:
        nvim_plugin = _normalize_required_string(
            path,
            "identifiers.nvim_plugin",
            identifiers_raw["nvim_plugin"],
        )

    identifiers = ThemeIdentifiers(
        ghostty=_normalize_required_string(path, "identifiers.ghostty", identifiers_raw["ghostty"]),
        nvim_colorscheme=_normalize_required_string(
            path,
            "identifiers.nvim_colorscheme",
            identifiers_raw["nvim_colorscheme"],
        ),
        antigravity=_normalize_required_string(
            path,
            "identifiers.antigravity",
            identifiers_raw["antigravity"],
        ),
        opencode=_normalize_required_string(path, "identifiers.opencode", identifiers_raw["opencode"]),
        obsidian=_normalize_required_string(path, "identifiers.obsidian", identifiers_raw["obsidian"]),
        nvim_plugin=nvim_plugin,
    )

    palette_raw = _require_table(path, raw, "palette")
    _ensure_required_keys(path, "palette", palette_raw, REQUIRED_PALETTE_KEYS)
    _ensure_known_keys(path, "palette", palette_raw, set(REQUIRED_PALETTE_KEYS))

    palette = ThemePalette(
        bg0=_normalize_hex_color(path, "palette.bg0", palette_raw["bg0"]),
        bg1=_normalize_hex_color(path, "palette.bg1", palette_raw["bg1"]),
        bg2=_normalize_hex_color(path, "palette.bg2", palette_raw["bg2"]),
        fg=_normalize_hex_color(path, "palette.fg", palette_raw["fg"]),
        grey=_normalize_hex_color(path, "palette.grey", palette_raw["grey"]),
        red=_normalize_hex_color(path, "palette.red", palette_raw["red"]),
        orange=_normalize_hex_color(path, "palette.orange", palette_raw["orange"]),
        yellow=_normalize_hex_color(path, "palette.yellow", palette_raw["yellow"]),
        green=_normalize_hex_color(path, "palette.green", palette_raw["green"]),
        cyan=_normalize_hex_color(path, "palette.cyan", palette_raw["cyan"]),
        blue=_normalize_hex_color(path, "palette.blue", palette_raw["blue"]),
        magenta=_normalize_hex_color(path, "palette.magenta", palette_raw["magenta"]),
    )

    overrides_raw = raw.get("overrides", {})
    overrides = _normalize_overrides(path, overrides_raw)

    return ThemeSource(
        schema_version=schema_version,
        file_path=path,
        theme=theme,
        identifiers=identifiers,
        palette=palette,
        overrides=overrides,
    )


def load_theme_sources(sources_dir: str | Path | None = None) -> list[ThemeSource]:
    resolved_sources_dir = Path(sources_dir).resolve() if sources_dir else default_sources_dir()
    if not resolved_sources_dir.exists():
        raise ThemeSourceError(resolved_sources_dir, "Sources directory does not exist")
    if not resolved_sources_dir.is_dir():
        raise ThemeSourceError(resolved_sources_dir, "Sources path is not a directory")

    source_files = sorted(resolved_sources_dir.glob("*.toml"))
    themes = [load_theme_source(path) for path in source_files]
    themes.sort(key=lambda theme_source: theme_source.theme.id)

    seen: dict[str, Path] = {}
    for theme_source in themes:
        theme_id = theme_source.theme.id
        previous = seen.get(theme_id)
        if previous is not None:
            raise ThemeSourceError(
                theme_source.file_path,
                f"Duplicate theme.id '{theme_id}' already defined in '{previous}'",
            )
        seen[theme_id] = theme_source.file_path

    return themes


def validate_theme_sources(sources_dir: str | Path | None = None) -> ValidationReport:
    resolved_sources_dir = Path(sources_dir).resolve() if sources_dir else default_sources_dir()
    issues: list[ValidationIssue] = []

    if not resolved_sources_dir.exists():
        issues.append(ValidationIssue(resolved_sources_dir, "Sources directory does not exist"))
        return ValidationReport(
            sources_dir=resolved_sources_dir,
            checked_files=0,
            valid_files=0,
            issues=tuple(issues),
        )
    if not resolved_sources_dir.is_dir():
        issues.append(ValidationIssue(resolved_sources_dir, "Sources path is not a directory"))
        return ValidationReport(
            sources_dir=resolved_sources_dir,
            checked_files=0,
            valid_files=0,
            issues=tuple(issues),
        )

    source_files = sorted(resolved_sources_dir.glob("*.toml"))
    valid_files = 0
    seen: dict[str, Path] = {}

    for source_file in source_files:
        try:
            theme_source = load_theme_source(source_file)
        except ThemeSourceError as error:
            issues.append(ValidationIssue(source_file, _extract_theme_source_error_message(error)))
            continue

        previous = seen.get(theme_source.theme.id)
        if previous is not None:
            issues.append(
                ValidationIssue(
                    theme_source.file_path,
                    f"Duplicate theme.id '{theme_source.theme.id}' already defined in '{previous}'",
                )
            )
            continue
        seen[theme_source.theme.id] = theme_source.file_path
        valid_files += 1

    return ValidationReport(
        sources_dir=resolved_sources_dir,
        checked_files=len(source_files),
        valid_files=valid_files,
        issues=tuple(issues),
    )


def load_theme_source_by_id(theme_id: str, sources_dir: str | Path | None = None) -> ThemeSource:
    normalized_theme_id = _normalize_theme_id(
        source_file=Path("<input>"),
        key_path="theme_id",
        value=theme_id,
    )
    resolved_sources_dir = Path(sources_dir).resolve() if sources_dir else default_sources_dir()
    return load_theme_source(resolved_sources_dir / f"{normalized_theme_id}.toml")


def run_check_mode(
    sources_dir: str | Path | None = None,
    output: TextIO | None = None,
) -> int:
    resolved_output = output if output is not None else sys.stdout
    report = validate_theme_sources(sources_dir)
    if report.is_valid:
        print(
            f"theme-build check: OK ({report.checked_files} file(s) validated in {report.sources_dir})",
            file=resolved_output,
        )
        return 0

    print(
        (
            "theme-build check: FAIL "
            f"({len(report.issues)} issue(s) across {report.checked_files} file(s) in {report.sources_dir})"
        ),
        file=resolved_output,
    )
    for issue in report.issues:
        print(f"- {issue.format()}", file=resolved_output)
    return 1


def render_sketchybar_colors(theme_source: ThemeSource) -> str:
    palette = theme_source.palette
    overrides = _extract_overrides_for_target(theme_source, "sketchybar")
    _assert_allowed_override_keys(
        theme_source,
        "sketchybar",
        overrides,
        {
            "black",
            "white",
            "red",
            "green",
            "blue",
            "yellow",
            "orange",
            "magenta",
            "grey",
            "highlight",
            "bg0",
            "bg1",
            "bg2",
            "border",
            "bar_border",
            "popup_border",
        },
    )

    black = _resolve_hex_override(theme_source, "sketchybar", overrides, "black", palette.bg2)
    white = _resolve_hex_override(theme_source, "sketchybar", overrides, "white", palette.fg)
    red = _resolve_hex_override(theme_source, "sketchybar", overrides, "red", palette.red)
    green = _resolve_hex_override(theme_source, "sketchybar", overrides, "green", palette.green)
    blue = _resolve_hex_override(theme_source, "sketchybar", overrides, "blue", palette.blue)
    yellow = _resolve_hex_override(theme_source, "sketchybar", overrides, "yellow", palette.yellow)
    orange = _resolve_hex_override(theme_source, "sketchybar", overrides, "orange", palette.orange)
    magenta = _resolve_hex_override(theme_source, "sketchybar", overrides, "magenta", palette.magenta)
    grey = _resolve_hex_override(theme_source, "sketchybar", overrides, "grey", palette.grey)
    highlight = _resolve_hex_override(theme_source, "sketchybar", overrides, "highlight", palette.blue)
    bg0 = _resolve_hex_override(theme_source, "sketchybar", overrides, "bg0", palette.bg0)
    bg1 = _resolve_hex_override(theme_source, "sketchybar", overrides, "bg1", palette.bg1)
    bg2 = _resolve_hex_override(theme_source, "sketchybar", overrides, "bg2", palette.bg2)

    default_border = _resolve_hex_override(theme_source, "sketchybar", overrides, "border", palette.cyan)
    bar_border = _resolve_hex_override(
        theme_source,
        "sketchybar",
        overrides,
        "bar_border",
        default_border,
    )
    popup_border = _resolve_hex_override(
        theme_source,
        "sketchybar",
        overrides,
        "popup_border",
        default_border,
    )

    lines = [
        "local colors = {",
        f"  black = {_hex_to_argb(black, 'ff')},",
        f"  white = {_hex_to_argb(white, 'ff')},",
        f"  red = {_hex_to_argb(red, 'ff')},",
        f"  green = {_hex_to_argb(green, 'ff')},",
        f"  blue = {_hex_to_argb(blue, 'ff')},",
        f"  yellow = {_hex_to_argb(yellow, 'ff')},",
        f"  orange = {_hex_to_argb(orange, 'ff')},",
        f"  magenta = {_hex_to_argb(magenta, 'ff')},",
        f"  grey = {_hex_to_argb(grey, 'ff')},",
        "  transparent = 0x00000000,",
        f"  highlight = {_hex_to_argb(highlight, '33')},",
        f"  bg0 = {_hex_to_argb(bg0, 'ff')},",
        f"  bg1 = {_hex_to_argb(bg1, 'ff')},",
        f"  bg2 = {_hex_to_argb(bg2, 'ff')},",
        "}",
        "",
        "colors.bar = {",
        "  bg = colors.bg0,",
        f"  border = {_hex_to_argb(bar_border, 'ff')},",
        "}",
        "",
        "colors.popup = {",
        "  bg = colors.bg0,",
        f"  border = {_hex_to_argb(popup_border, 'ff')},",
        "}",
        "",
        "return colors",
    ]
    return "\n".join(lines) + "\n"


def render_borders_config(theme_source: ThemeSource) -> str:
    palette = theme_source.palette
    overrides = _extract_overrides_for_target(theme_source, "borders")
    _assert_allowed_override_keys(
        theme_source,
        "borders",
        overrides,
        {
            "active_color",
            "inactive_color",
        },
    )

    active_color = _resolve_hex_override(theme_source, "borders", overrides, "active_color", palette.fg)
    inactive_color = _resolve_hex_override(theme_source, "borders", overrides, "inactive_color", palette.bg2)

    lines = [
        "#!/usr/bin/env bash",
        "options=(",
        "  style=round",
        "  width=5.0",
        "  hidpi=off",
        f"  active_color={_hex_to_argb(active_color, 'ff')}",
        f"  inactive_color={_hex_to_argb(inactive_color, 'b3')}",
        "  ax_focus=off",
        ")",
        'borders "${options[@]}"',
    ]
    return "\n".join(lines) + "\n"


def render_tmux_config(theme_source: ThemeSource) -> str:
    palette = theme_source.palette
    overrides = _extract_overrides_for_target(theme_source, "tmux")
    tmux_color_defaults: dict[str, str] = {
        "thm_bg": palette.bg1,
        "thm_fg": palette.fg,
        "thm_crust": palette.bg0,
        "thm_mantle": palette.bg0,
        "thm_surface_0": palette.bg2,
        "thm_surface_1": palette.bg2,
        "thm_surface_2": palette.grey,
        "thm_overlay_0": palette.grey,
        "thm_overlay_1": palette.grey,
        "thm_overlay_2": palette.grey,
        "thm_subtext_0": palette.fg,
        "thm_subtext_1": palette.fg,
        "thm_red": palette.red,
        "thm_maroon": palette.orange,
        "thm_peach": palette.orange,
        "thm_yellow": palette.yellow,
        "thm_green": palette.green,
        "thm_teal": palette.cyan,
        "thm_sky": palette.blue,
        "thm_sapphire": palette.cyan,
        "thm_blue": palette.blue,
        "thm_lavender": palette.magenta,
        "thm_mauve": palette.magenta,
        "thm_pink": palette.red,
        "thm_flamingo": palette.red,
        "thm_rosewater": palette.fg,
    }
    special_override_keys = {
        "catppuccin_session_color",
        "catppuccin_status_application_icon_bg",
        "catppuccin_status_uptime_icon_bg",
        "pane_border_style_fg",
        "pane_active_border_style_fg",
    }
    _assert_allowed_override_keys(
        theme_source,
        "tmux",
        overrides,
        set(tmux_color_defaults.keys()).union(special_override_keys),
    )

    resolved_tmux_colors = {
        key: _resolve_hex_override(theme_source, "tmux", overrides, key, value)
        for key, value in tmux_color_defaults.items()
    }
    session_color = _resolve_string_override(
        theme_source,
        "tmux",
        overrides,
        "catppuccin_session_color",
        "#{?client_prefix,#{E:@thm_mauve},#{E:@thm_green}}",
    )
    status_application_icon_bg = _resolve_hex_override(
        theme_source,
        "tmux",
        overrides,
        "catppuccin_status_application_icon_bg",
        resolved_tmux_colors["thm_sky"],
    )
    status_uptime_icon_bg = _resolve_hex_override(
        theme_source,
        "tmux",
        overrides,
        "catppuccin_status_uptime_icon_bg",
        resolved_tmux_colors["thm_yellow"],
    )
    pane_border_style_fg = _resolve_hex_override(
        theme_source,
        "tmux",
        overrides,
        "pane_border_style_fg",
        resolved_tmux_colors["thm_overlay_2"],
    )
    pane_active_border_style_fg = _resolve_hex_override(
        theme_source,
        "tmux",
        overrides,
        "pane_active_border_style_fg",
        resolved_tmux_colors["thm_green"],
    )

    theme_title = _title_case_theme_id(theme_source.theme.id)
    lines = [
        f"# {theme_title} theme - Catppuccin color overrides",
        "# Managed by theme-set - do not edit manually",
        "",
        "# Base",
        f'set -g @thm_bg "{resolved_tmux_colors["thm_bg"]}"',
        f'set -g @thm_fg "{resolved_tmux_colors["thm_fg"]}"',
        f'set -g @thm_crust "{resolved_tmux_colors["thm_crust"]}"',
        f'set -g @thm_mantle "{resolved_tmux_colors["thm_mantle"]}"',
        "",
        "# Surfaces",
        f'set -g @thm_surface_0 "{resolved_tmux_colors["thm_surface_0"]}"',
        f'set -g @thm_surface_1 "{resolved_tmux_colors["thm_surface_1"]}"',
        f'set -g @thm_surface_2 "{resolved_tmux_colors["thm_surface_2"]}"',
        "",
        "# Overlays",
        f'set -g @thm_overlay_0 "{resolved_tmux_colors["thm_overlay_0"]}"',
        f'set -g @thm_overlay_1 "{resolved_tmux_colors["thm_overlay_1"]}"',
        f'set -g @thm_overlay_2 "{resolved_tmux_colors["thm_overlay_2"]}"',
        "",
        "# Text",
        f'set -g @thm_subtext_0 "{resolved_tmux_colors["thm_subtext_0"]}"',
        f'set -g @thm_subtext_1 "{resolved_tmux_colors["thm_subtext_1"]}"',
        "",
        "# Accents",
        f'set -g @thm_red "{resolved_tmux_colors["thm_red"]}"',
        f'set -g @thm_maroon "{resolved_tmux_colors["thm_maroon"]}"',
        f'set -g @thm_peach "{resolved_tmux_colors["thm_peach"]}"',
        f'set -g @thm_yellow "{resolved_tmux_colors["thm_yellow"]}"',
        f'set -g @thm_green "{resolved_tmux_colors["thm_green"]}"',
        f'set -g @thm_teal "{resolved_tmux_colors["thm_teal"]}"',
        f'set -g @thm_sky "{resolved_tmux_colors["thm_sky"]}"',
        f'set -g @thm_sapphire "{resolved_tmux_colors["thm_sapphire"]}"',
        f'set -g @thm_blue "{resolved_tmux_colors["thm_blue"]}"',
        f'set -g @thm_lavender "{resolved_tmux_colors["thm_lavender"]}"',
        f'set -g @thm_mauve "{resolved_tmux_colors["thm_mauve"]}"',
        f'set -g @thm_pink "{resolved_tmux_colors["thm_pink"]}"',
        f'set -g @thm_flamingo "{resolved_tmux_colors["thm_flamingo"]}"',
        f'set -g @thm_rosewater "{resolved_tmux_colors["thm_rosewater"]}"',
        "",
        "# Window overrides",
        'set -g @catppuccin_window_current_number_color "#{@thm_teal}"',
        'set -g @catppuccin_window_number_color "#{@thm_overlay_2}"',
        "",
        "# Status module overrides (bypasses plugin -o caching on reload)",
        f'set -g @catppuccin_session_color "{session_color}"',
        f'set -g @catppuccin_status_application_icon_bg "{status_application_icon_bg}"',
        f'set -g @catppuccin_status_uptime_icon_bg "{status_uptime_icon_bg}"',
        "",
        "# Pane borders",
        f'set -g pane-border-style "fg={pane_border_style_fg}"',
        f'set -g pane-active-border-style "fg={pane_active_border_style_fg}"',
    ]
    return "\n".join(lines) + "\n"


def render_ghostty_config(theme_source: ThemeSource) -> str:
    palette = theme_source.palette
    overrides = _extract_overrides_for_target(theme_source, "ghostty")
    _assert_allowed_override_keys(
        theme_source,
        "ghostty",
        overrides,
        {
            "theme",
            "header_title",
            "split_divider_color",
        },
    )

    header_title = _resolve_string_override(
        theme_source,
        "ghostty",
        overrides,
        "header_title",
        _default_ghostty_header_title(theme_source),
    )
    ghostty_theme_name = _resolve_string_override(
        theme_source,
        "ghostty",
        overrides,
        "theme",
        theme_source.identifiers.ghostty,
    )
    split_divider_color = _resolve_hex_override(
        theme_source,
        "ghostty",
        overrides,
        "split_divider_color",
        palette.fg,
    )

    lines = [
        f"# {header_title} theme for Ghostty",
        "# Managed by theme-set - do not edit manually",
        f"theme = {ghostty_theme_name}",
        f"split-divider-color = {split_divider_color}",
    ]
    return "\n".join(lines) + "\n"


def render_neovim_config(theme_source: ThemeSource) -> str:
    overrides = _extract_overrides_for_target(theme_source, "neovim")
    _assert_allowed_override_keys(
        theme_source,
        "neovim",
        overrides,
        {
            "plugin",
            "lazy",
            "priority",
            "dev",
            "background",
            "background_variable",
            "contrast",
            "setup_module",
            "config_lua",
            "header_title",
        },
    )

    plugin = _resolve_string_override(
        theme_source,
        "neovim",
        overrides,
        "plugin",
        theme_source.identifiers.nvim_plugin or "",
    )
    plugin = plugin if plugin else None

    plugin_scoped_keys = {
        "plugin",
        "lazy",
        "priority",
        "dev",
        "background",
        "background_variable",
        "contrast",
        "setup_module",
        "config_lua",
    }
    if plugin is None:
        plugin_override_keys = sorted(set(overrides.keys()).intersection(plugin_scoped_keys))
        if plugin_override_keys:
            overrides_display = ", ".join(plugin_override_keys)
            raise ThemeSourceError(
                theme_source.file_path,
                (
                    "identifiers.nvim_plugin is required when using "
                    f"plugin-scoped neovim overrides ({overrides_display})"
                ),
            )

    header_title = _resolve_string_override(
        theme_source,
        "neovim",
        overrides,
        "header_title",
        theme_source.theme.name,
    )

    plugin_lazy = _resolve_bool_override(
        theme_source,
        "neovim",
        overrides,
        "lazy",
        False,
    )
    plugin_priority = _resolve_int_override(
        theme_source,
        "neovim",
        overrides,
        "priority",
        1000,
    )
    plugin_dev = _resolve_bool_override(
        theme_source,
        "neovim",
        overrides,
        "dev",
        False,
    )

    config_lua_lines: list[str] = []
    if "background" in overrides:
        background_value = _resolve_string_override(
            theme_source,
            "neovim",
            overrides,
            "background",
            "",
        )
        background_variable = _resolve_string_override(
            theme_source,
            "neovim",
            overrides,
            "background_variable",
            _default_neovim_background_variable(theme_source),
        )
        background_variable = _normalize_lua_identifier(
            theme_source.file_path,
            "overrides.neovim.background_variable",
            background_variable,
        )
        config_lua_lines.append(
            f'vim.g.{background_variable} = "{_escape_lua_string(background_value)}"'
        )

    if "contrast" in overrides:
        contrast_value = _resolve_string_override(
            theme_source,
            "neovim",
            overrides,
            "contrast",
            "",
        )
        setup_module = _resolve_string_override(
            theme_source,
            "neovim",
            overrides,
            "setup_module",
            _default_neovim_setup_module(theme_source, plugin),
        )
        config_lua_lines.extend(
            [
                f'require("{_escape_lua_string(setup_module)}").setup({{',
                f'  contrast = "{_escape_lua_string(contrast_value)}",',
                "})",
            ]
        )

    if "config_lua" in overrides:
        config_lua = _resolve_string_override(
            theme_source,
            "neovim",
            overrides,
            "config_lua",
            "",
        )
        config_lua_lines.extend(config_lua.splitlines())

    lines = [
        f"-- {header_title} theme for Neovim (LazyVim)",
        "-- Managed by theme-set, symlinked to ~/.config/nvim/lua/plugins/theme.lua",
        "return {",
    ]

    if plugin is not None:
        lines.extend(
            [
                "  {",
                f'    "{plugin}",',
                f"    lazy = {_lua_bool(plugin_lazy)},",
                f"    priority = {plugin_priority},",
            ]
        )
        if plugin_dev:
            lines.append("    dev = true,")
        if config_lua_lines:
            lines.append("    config = function()")
            for lua_line in config_lua_lines:
                if lua_line:
                    lines.append(f"      {lua_line}")
                else:
                    lines.append("")
            lines.append("    end,")
        lines.append("  },")

    lines.extend(
        [
            "  {",
            '    "LazyVim/LazyVim",',
            "    opts = {",
            f'      colorscheme = "{_escape_lua_string(theme_source.identifiers.nvim_colorscheme)}",',
            "    },",
            "  },",
            "}",
        ]
    )
    return "\n".join(lines) + "\n"


def render_obsidian_snippet(theme_source: ThemeSource) -> str:
    palette = theme_source.palette
    overrides = _extract_overrides_for_target(theme_source, "obsidian")
    _assert_allowed_override_keys(
        theme_source,
        "obsidian",
        overrides,
        {
            "variable_prefix",
            "sidebar_color",
            "editor_color",
            "foreground_color",
            "muted_color",
            "folder_color",
            "active_file_accent",
            "active_file_alpha",
        },
    )

    default_prefix = theme_source.theme.id.replace("-", "")
    prefix = _resolve_string_override(
        theme_source,
        "obsidian",
        overrides,
        "variable_prefix",
        default_prefix,
    )
    prefix_key_path = (
        "overrides.obsidian.variable_prefix"
        if "variable_prefix" in overrides
        else "default.obsidian.variable_prefix"
    )
    variable_prefix = _normalize_css_identifier(theme_source.file_path, prefix_key_path, prefix)

    sidebar_color = _resolve_hex_override(
        theme_source,
        "obsidian",
        overrides,
        "sidebar_color",
        palette.bg0,
    )
    editor_color = _resolve_hex_override(
        theme_source,
        "obsidian",
        overrides,
        "editor_color",
        palette.bg1,
    )
    foreground_color = _resolve_hex_override(
        theme_source,
        "obsidian",
        overrides,
        "foreground_color",
        palette.fg,
    )
    muted_color = _resolve_hex_override(
        theme_source,
        "obsidian",
        overrides,
        "muted_color",
        palette.grey,
    )
    folder_color = _resolve_hex_override(
        theme_source,
        "obsidian",
        overrides,
        "folder_color",
        palette.blue,
    )
    active_file_accent = _resolve_hex_override(
        theme_source,
        "obsidian",
        overrides,
        "active_file_accent",
        palette.blue,
    )
    active_file_alpha = _resolve_float_override(
        theme_source,
        "obsidian",
        overrides,
        "active_file_alpha",
        0.15,
        minimum=0.0,
        maximum=1.0,
    )
    active_file_alpha_literal = _format_decimal(active_file_alpha)
    active_file_accent_rgb = _hex_to_rgb_triplet(active_file_accent)

    lines = [
        ":root {",
        f"  --{variable_prefix}-sidebar: {sidebar_color};",
        f"  --{variable_prefix}-editor: {editor_color};",
        f"  --{variable_prefix}-fg: {foreground_color};",
        f"  --{variable_prefix}-muted: {muted_color};",
        f"  --{variable_prefix}-folder: {folder_color};",
        f"  --{variable_prefix}-accent: {active_file_accent};",
        f"  --nav-item-color-active: var(--{variable_prefix}-fg);",
        "  --nav-item-weight-active: 600;",
        "}",
        "",
        "body,",
        ".app-container,",
        ".workspace {",
        f"  background-color: var(--{variable_prefix}-sidebar) !important;",
        "}",
        "",
        ".workspace-split.mod-left-split,",
        ".workspace-split.mod-left-split .workspace-leaf-content,",
        ".workspace-split.mod-left-split .view-content,",
        ".workspace-drawer.mod-left,",
        ".nav-files-container,",
        ".workspace-ribbon.mod-left {",
        f"  background-color: var(--{variable_prefix}-sidebar) !important;",
        "}",
        "",
        ".workspace-split.mod-root .workspace-leaf-content,",
        ".workspace-split.mod-root .view-content,",
        ".workspace-split.mod-root .view-header,",
        ".workspace-split.mod-root .markdown-source-view.mod-cm6 .cm-scroller,",
        ".workspace-split.mod-root .markdown-preview-view,",
        ".workspace-split.mod-root .empty-state,",
        ".workspace-split.mod-root .empty-state-container {",
        f"  background-color: var(--{variable_prefix}-editor) !important;",
        "}",
        "",
        ".view-header-breadcrumb,",
        ".view-header-breadcrumb-separator,",
        ".view-header-title {",
        f"  color: var(--{variable_prefix}-fg) !important;",
        "}",
        "",
        ".workspace-tab-header-container {",
        f"  background-color: var(--{variable_prefix}-sidebar) !important;",
        "  border-bottom: none !important;",
        "}",
        "",
        ".workspace-tab-header {",
        f"  color: var(--{variable_prefix}-muted) !important;",
        "  background-color: transparent !important;",
        "}",
        "",
        ".workspace-tab-header.is-active {",
        f"  color: var(--{variable_prefix}-fg) !important;",
        f"  background-color: var(--{variable_prefix}-editor) !important;",
        "  box-shadow: none !important;",
        "  border: none !important;",
        "}",
        "",
        ".workspace-tab-header.is-active::before,",
        ".workspace-tab-header.is-active::after {",
        "  display: none !important;",
        "}",
        "",
        ".nav-file-title,",
        ".nav-file-title-content {",
        f"  color: var(--{variable_prefix}-fg) !important;",
        "}",
        "",
        "body:not(.is-grabbing) .nav-file-title.is-active,",
        "body:not(.is-grabbing) .nav-folder-title.is-active,",
        ".nav-file-title.is-active,",
        ".nav-folder-title.is-active {",
        f"  color: var(--{variable_prefix}-fg) !important;",
        f"  background-color: rgba({active_file_accent_rgb}, {active_file_alpha_literal}) !important;",
        "  font-weight: 600 !important;",
        "}",
        "",
        ".nav-file-title.is-active .nav-file-title-content::before,",
        ".nav-folder-title.is-active .nav-folder-title-content::before {",
        '  content: "\\2726 ";',
        f"  color: var(--{variable_prefix}-fg);",
        "  font-weight: 700;",
        "}",
        "",
        ".nav-folder-title .nav-folder-title-content {",
        f"  color: var(--{variable_prefix}-folder);",
        "  font-weight: 800;",
        "}",
        "",
        ".nav-folder-title.is-active .nav-folder-title-content {",
        f"  color: var(--{variable_prefix}-folder) !important;",
        "  font-weight: 800;",
        "}",
        "",
        ".nav-file-title.is-active .nav-file-title-content,",
        ".nav-folder-title.is-active .nav-folder-title-content {",
        f"  color: var(--{variable_prefix}-fg) !important;",
        f"  caret-color: var(--{variable_prefix}-fg);",
        "}",
        "",
        ".nav-folder.is-collapsed > .nav-folder-title .nav-folder-title-content::before {",
        '  content: "\\f07b ";',
        '  font-family: "JetBrainsMono Nerd Font";',
        f"  color: var(--{variable_prefix}-folder);",
        "  padding-right: 8px;",
        "}",
        "",
        ".nav-folder:not(.is-collapsed)",
        "  > .nav-folder-title",
        "  .nav-folder-title-content::before {",
        '  content: "\\f07c ";',
        '  font-family: "JetBrainsMono Nerd Font";',
        f"  color: var(--{variable_prefix}-folder);",
        "  padding-right: 8px;",
        "}",
        "",
        ".markdown-source-view.mod-cm6,",
        ".markdown-preview-view {",
        "  --checklist-done-decoration: none !important;",
        f"  --checklist-done-color: var(--{variable_prefix}-muted) !important;",
        "}",
        "",
        '.markdown-source-view.mod-cm6 .HyperMD-task-line[data-task="x"],',
        '.markdown-source-view.mod-cm6 .HyperMD-task-line[data-task="X"],',
        ".markdown-source-view.mod-cm6 .task-list-item.is-checked,",
        ".markdown-source-view.mod-cm6 .task-list-item.is-checked .task-list-label,",
        ".markdown-preview-view .task-list-item.is-checked,",
        ".markdown-preview-view .task-list-item.is-checked .task-list-label {",
        "  text-decoration: none !important;",
        "  text-decoration-line: none !important;",
        f"  color: var(--{variable_prefix}-muted) !important;",
        "  opacity: 1 !important;",
        "}",
    ]
    return "\n".join(lines) + "\n"


def render_theme_app_configs(theme_source: ThemeSource) -> dict[str, str]:
    return {
        "sketchybar-colors.lua": render_sketchybar_colors(theme_source),
        "bordersrc": render_borders_config(theme_source),
        "tmux.conf": render_tmux_config(theme_source),
        "ghostty.conf": render_ghostty_config(theme_source),
        "neovim.lua": render_neovim_config(theme_source),
        "obsidian-snippet.css": render_obsidian_snippet(theme_source),
    }


def generate_theme_config_files(
    sources_dir: str | Path | None = None,
    configs_dir: str | Path | None = None,
) -> list[Path]:
    resolved_configs_dir = Path(configs_dir).resolve() if configs_dir else default_configs_dir()
    resolved_configs_dir.mkdir(parents=True, exist_ok=True)

    theme_sources = load_theme_sources(sources_dir)
    written_files: list[Path] = []
    expected_files: set[Path] = set()

    for theme_source in theme_sources:
        theme_dir = resolved_configs_dir / theme_source.theme.id
        theme_dir.mkdir(parents=True, exist_ok=True)
        rendered_configs = render_theme_app_configs(theme_source)

        for filename in MANAGED_THEME_CONFIG_FILENAMES:
            config_path = theme_dir / filename
            config_path.write_text(rendered_configs[filename], encoding="utf-8")
            written_files.append(config_path)
            expected_files.add(config_path)

    for theme_dir in sorted(path for path in resolved_configs_dir.iterdir() if path.is_dir()):
        for filename in MANAGED_THEME_CONFIG_FILENAMES:
            stale_file = theme_dir / filename
            if stale_file.exists() and stale_file not in expected_files:
                stale_file.unlink()

    return written_files


def run_generate_configs_mode(
    sources_dir: str | Path | None = None,
    configs_dir: str | Path | None = None,
    output: TextIO | None = None,
) -> int:
    resolved_output = output if output is not None else sys.stdout
    try:
        written_files = generate_theme_config_files(sources_dir=sources_dir, configs_dir=configs_dir)
    except ThemeSourceError as error:
        print(f"theme-build generate-configs: FAIL ({error})", file=resolved_output)
        return 1

    resolved_configs_dir = Path(configs_dir).resolve() if configs_dir else default_configs_dir()
    print(
        f"theme-build generate-configs: OK ({len(written_files)} file(s) written to {resolved_configs_dir})",
        file=resolved_output,
    )
    return 0


def render_solid_wallpaper_png(
    theme_source: ThemeSource,
    *,
    width: int = DEFAULT_WALLPAPER_WIDTH,
    height: int = DEFAULT_WALLPAPER_HEIGHT,
) -> bytes:
    red, green, blue = _hex_to_rgb_channels(theme_source.palette.bg0)
    return _render_solid_png(width, height, red, green, blue)


def generate_theme_wallpaper_files(
    sources_dir: str | Path | None = None,
    wallpapers_dir: str | Path | None = None,
) -> list[Path]:
    resolved_wallpapers_dir = Path(wallpapers_dir).resolve() if wallpapers_dir else default_wallpapers_dir()
    resolved_wallpapers_dir.mkdir(parents=True, exist_ok=True)

    theme_sources = load_theme_sources(sources_dir)
    written_files: list[Path] = []
    expected_files: set[Path] = set()

    for theme_source in theme_sources:
        theme_dir = resolved_wallpapers_dir / theme_source.theme.id
        theme_dir.mkdir(parents=True, exist_ok=True)
        wallpaper_path = theme_dir / MANAGED_WALLPAPER_FILENAME
        wallpaper_path.write_bytes(render_solid_wallpaper_png(theme_source))
        written_files.append(wallpaper_path)
        expected_files.add(wallpaper_path)

    for theme_dir in sorted(path for path in resolved_wallpapers_dir.iterdir() if path.is_dir()):
        stale_file = theme_dir / MANAGED_WALLPAPER_FILENAME
        if stale_file.exists() and stale_file not in expected_files:
            stale_file.unlink()

    return written_files


def run_generate_wallpapers_mode(
    sources_dir: str | Path | None = None,
    wallpapers_dir: str | Path | None = None,
    output: TextIO | None = None,
) -> int:
    resolved_output = output if output is not None else sys.stdout
    try:
        written_files = generate_theme_wallpaper_files(
            sources_dir=sources_dir,
            wallpapers_dir=wallpapers_dir,
        )
    except ThemeSourceError as error:
        print(f"theme-build generate-wallpapers: FAIL ({error})", file=resolved_output)
        return 1

    resolved_wallpapers_dir = Path(wallpapers_dir).resolve() if wallpapers_dir else default_wallpapers_dir()
    print(
        "theme-build generate-wallpapers: OK "
        f"({len(written_files)} file(s) written to {resolved_wallpapers_dir})",
        file=resolved_output,
    )
    return 0


def render_theme_meta_env(theme_source: ThemeSource) -> str:
    identifiers = theme_source.identifiers
    palette = theme_source.palette

    lines = [
        f"# {theme_source.theme.name} Theme Metadata",
        "# Generated from canonical TOML source. Do not edit manually.",
        f"# Canonical source: {theme_source.theme.source}",
        "",
        f"THEME_NAME={_shell_double_quote(theme_source.theme.name)}",
        f"THEME_VARIANT={_shell_double_quote(theme_source.theme.variant)}",
        "",
        "# App-specific theme identifiers",
        f"GHOSTTY_THEME={_shell_double_quote(identifiers.ghostty)}",
        f"NVIM_COLORSCHEME={_shell_double_quote(identifiers.nvim_colorscheme)}",
        f"NVIM_PLUGIN={_shell_double_quote(identifiers.nvim_plugin or '')}",
        f"ANTIGRAVITY_THEME={_shell_double_quote(identifiers.antigravity)}",
        f"OPENCODE_THEME={_shell_double_quote(identifiers.opencode)}",
        f"OBSIDIAN_THEME={_shell_double_quote(identifiers.obsidian)}",
        "",
        "# Core palette (canonical #RRGGBB format)",
        f"BG_COLOR={_shell_double_quote(palette.bg0)}",
        f"BG_HIGHLIGHT={_shell_double_quote(palette.bg1)}",
        f"FG_COLOR={_shell_double_quote(palette.fg)}",
        f"RED={_shell_double_quote(palette.red)}",
        f"ORANGE={_shell_double_quote(palette.orange)}",
        f"YELLOW={_shell_double_quote(palette.yellow)}",
        f"GREEN={_shell_double_quote(palette.green)}",
        f"AQUA={_shell_double_quote(palette.cyan)}",
        f"CYAN={_shell_double_quote(palette.cyan)}",
        f"BLUE={_shell_double_quote(palette.blue)}",
        f"MAGENTA={_shell_double_quote(palette.magenta)}",
        f"COMMENT={_shell_double_quote(palette.grey)}",
        f"BLACK={_shell_double_quote(palette.bg2)}",
    ]
    return "\n".join(lines) + "\n"


def generate_theme_meta_files(
    sources_dir: str | Path | None = None,
    meta_dir: str | Path | None = None,
) -> list[Path]:
    resolved_meta_dir = Path(meta_dir).resolve() if meta_dir else default_meta_dir()
    resolved_meta_dir.mkdir(parents=True, exist_ok=True)

    theme_sources = load_theme_sources(sources_dir)
    written_files: list[Path] = []
    expected_files: set[Path] = set()

    for theme_source in theme_sources:
        meta_file = resolved_meta_dir / f"{theme_source.theme.id}.env"
        meta_file.write_text(render_theme_meta_env(theme_source), encoding="utf-8")
        written_files.append(meta_file)
        expected_files.add(meta_file)

    stale_meta_files = sorted(path for path in resolved_meta_dir.glob("*.env") if path not in expected_files)
    for stale_meta_file in stale_meta_files:
        stale_meta_file.unlink()

    return written_files


def run_generate_meta_mode(
    sources_dir: str | Path | None = None,
    meta_dir: str | Path | None = None,
    output: TextIO | None = None,
) -> int:
    resolved_output = output if output is not None else sys.stdout
    try:
        written_files = generate_theme_meta_files(sources_dir, meta_dir)
    except ThemeSourceError as error:
        print(f"theme-build generate-meta: FAIL ({error})", file=resolved_output)
        return 1

    resolved_meta_dir = Path(meta_dir).resolve() if meta_dir else default_meta_dir()
    print(
        f"theme-build generate-meta: OK ({len(written_files)} file(s) written to {resolved_meta_dir})",
        file=resolved_output,
    )
    return 0


def render_themes_manifest(theme_sources: Sequence[ThemeSource]) -> str:
    sorted_sources = sorted(theme_sources, key=lambda theme_source: theme_source.theme.id)
    payload = {
        "themes": [
            {
                "id": theme_source.theme.id,
                "name": theme_source.theme.name,
                "colors": {
                    key: getattr(theme_source.palette, key)
                    for key in THEME_JSON_COLOR_KEYS
                },
            }
            for theme_source in sorted_sources
        ]
    }
    return json.dumps(payload, indent=2) + "\n"


def generate_themes_manifest_file(
    sources_dir: str | Path | None = None,
    themes_json_path: str | Path | None = None,
) -> Path:
    resolved_themes_json_path = (
        Path(themes_json_path).resolve()
        if themes_json_path
        else default_themes_json_path()
    )
    resolved_themes_json_path.parent.mkdir(parents=True, exist_ok=True)

    theme_sources = load_theme_sources(sources_dir)
    rendered_manifest = render_themes_manifest(theme_sources)
    resolved_themes_json_path.write_text(rendered_manifest, encoding="utf-8")
    return resolved_themes_json_path


def run_generate_themes_json_mode(
    sources_dir: str | Path | None = None,
    themes_json_path: str | Path | None = None,
    output: TextIO | None = None,
) -> int:
    resolved_output = output if output is not None else sys.stdout
    try:
        written_path = generate_themes_manifest_file(
            sources_dir=sources_dir,
            themes_json_path=themes_json_path,
        )
    except ThemeSourceError as error:
        print(f"theme-build generate-themes-json: FAIL ({error})", file=resolved_output)
        return 1

    print(
        f"theme-build generate-themes-json: OK (wrote {written_path})",
        file=resolved_output,
    )
    return 0


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build and validate canonical theme TOML sources.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate all source TOML files and exit non-zero on violations.",
    )
    parser.add_argument(
        "--generate-meta",
        action="store_true",
        help="Generate themes/meta/*.env files from source TOML values.",
    )
    parser.add_argument(
        "--generate-themes-json",
        action="store_true",
        help="Generate themes/themes.json from source TOML values.",
    )
    parser.add_argument(
        "--generate-configs",
        action="store_true",
        help="Generate themes/configs/<theme-id> app config files from source TOML values.",
    )
    parser.add_argument(
        "--generate-wallpapers",
        action="store_true",
        help="Generate themes/wallpapers/<theme-id>/1-solid.png from source TOML values.",
    )
    parser.add_argument(
        "--sources-dir",
        type=Path,
        default=default_sources_dir(),
        help="Directory containing canonical source TOML files.",
    )
    parser.add_argument(
        "--meta-dir",
        type=Path,
        default=default_meta_dir(),
        help="Directory for generated theme metadata env files.",
    )
    parser.add_argument(
        "--configs-dir",
        type=Path,
        default=default_configs_dir(),
        help="Directory for generated per-theme app config files.",
    )
    parser.add_argument(
        "--wallpapers-dir",
        type=Path,
        default=default_wallpapers_dir(),
        help="Directory for generated per-theme wallpaper artifacts.",
    )
    parser.add_argument(
        "--themes-json-path",
        type=Path,
        default=default_themes_json_path(),
        help="Output path for generated themes.json manifest.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_arg_parser()
    args = parser.parse_args(argv)

    selected_modes = [
        bool(args.check),
        bool(args.generate_meta),
        bool(args.generate_themes_json),
        bool(args.generate_configs),
        bool(args.generate_wallpapers),
    ]
    if sum(selected_modes) > 1:
        parser.error(
            "--check, --generate-meta, --generate-themes-json, --generate-configs, and --generate-wallpapers are mutually exclusive"
        )

    if args.check:
        return run_check_mode(args.sources_dir)
    if args.generate_meta:
        return run_generate_meta_mode(args.sources_dir, args.meta_dir)
    if args.generate_themes_json:
        return run_generate_themes_json_mode(args.sources_dir, args.themes_json_path)
    if args.generate_configs:
        return run_generate_configs_mode(args.sources_dir, args.configs_dir)
    if args.generate_wallpapers:
        return run_generate_wallpapers_mode(args.sources_dir, args.wallpapers_dir)
    parser.print_help(sys.stderr)
    return 2


def _extract_theme_source_error_message(error: ThemeSourceError) -> str:
    raw_message = str(error)
    prefix = f"{error.source_file}: "
    if raw_message.startswith(prefix):
        return raw_message[len(prefix) :]
    return raw_message


def _extract_overrides_for_target(theme_source: ThemeSource, target: str) -> Mapping[str, Any]:
    target_overrides = theme_source.overrides.get(target, {})
    if not isinstance(target_overrides, dict):
        raise ThemeSourceError(theme_source.file_path, f"overrides.{target} must be a TOML table")
    return target_overrides


def _assert_allowed_override_keys(
    theme_source: ThemeSource,
    target: str,
    overrides: Mapping[str, Any],
    allowed_keys: set[str],
) -> None:
    unknown = sorted(set(overrides.keys()) - allowed_keys)
    if unknown:
        unknown_display = ", ".join(unknown)
        raise ThemeSourceError(
            theme_source.file_path,
            f"Unknown key(s) in overrides.{target}: {unknown_display}",
        )


def _resolve_hex_override(
    theme_source: ThemeSource,
    target: str,
    overrides: Mapping[str, Any],
    key: str,
    default: str,
) -> str:
    value = overrides.get(key, default)
    key_path = f"overrides.{target}.{key}" if key in overrides else f"default.{target}.{key}"
    return _normalize_hex_color(theme_source.file_path, key_path, value)


def _resolve_string_override(
    theme_source: ThemeSource,
    target: str,
    overrides: Mapping[str, Any],
    key: str,
    default: str,
) -> str:
    if key not in overrides:
        return default
    return _normalize_required_string(theme_source.file_path, f"overrides.{target}.{key}", overrides[key])


def _resolve_bool_override(
    theme_source: ThemeSource,
    target: str,
    overrides: Mapping[str, Any],
    key: str,
    default: bool,
) -> bool:
    value = overrides.get(key, default)
    if isinstance(value, bool):
        return value
    key_path = f"overrides.{target}.{key}" if key in overrides else f"default.{target}.{key}"
    raise ThemeSourceError(theme_source.file_path, f"{key_path} must be a boolean")


def _resolve_int_override(
    theme_source: ThemeSource,
    target: str,
    overrides: Mapping[str, Any],
    key: str,
    default: int,
) -> int:
    value = overrides.get(key, default)
    key_path = f"overrides.{target}.{key}" if key in overrides else f"default.{target}.{key}"
    if isinstance(value, bool) or not isinstance(value, int):
        raise ThemeSourceError(theme_source.file_path, f"{key_path} must be an integer")
    return value


def _resolve_float_override(
    theme_source: ThemeSource,
    target: str,
    overrides: Mapping[str, Any],
    key: str,
    default: float,
    *,
    minimum: float | None = None,
    maximum: float | None = None,
) -> float:
    value = overrides.get(key, default)
    key_path = f"overrides.{target}.{key}" if key in overrides else f"default.{target}.{key}"
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ThemeSourceError(theme_source.file_path, f"{key_path} must be a number")
    resolved = float(value)
    if minimum is not None and resolved < minimum:
        raise ThemeSourceError(theme_source.file_path, f"{key_path} must be >= {minimum}")
    if maximum is not None and resolved > maximum:
        raise ThemeSourceError(theme_source.file_path, f"{key_path} must be <= {maximum}")
    return resolved


def _hex_to_argb(hex_color: str, alpha: str) -> str:
    resolved_alpha = alpha.lower()
    if not re.fullmatch(r"[0-9a-f]{2}", resolved_alpha):
        raise ValueError(f"alpha must be two lowercase hex chars, got '{alpha}'")
    return f"0x{resolved_alpha}{hex_color.removeprefix('#').lower()}"


def _hex_to_rgb_triplet(hex_color: str) -> str:
    red, green, blue = _hex_to_rgb_channels(hex_color)
    return f"{red}, {green}, {blue}"


def _hex_to_rgb_channels(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"hex color must be 6 characters, got '{hex_color}'")
    red = int(value[0:2], 16)
    green = int(value[2:4], 16)
    blue = int(value[4:6], 16)
    return red, green, blue


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    chunk_length = struct.pack(">I", len(data))
    chunk_crc = struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    return chunk_length + chunk_type + data + chunk_crc


def _render_solid_png(width: int, height: int, red: int, green: int, blue: int) -> bytes:
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr_chunk = _png_chunk(b"IHDR", ihdr_data)

    row = bytes([0] + [red, green, blue] * width)
    compressed_data = zlib.compress(row * height, 9)
    idat_chunk = _png_chunk(b"IDAT", compressed_data)
    iend_chunk = _png_chunk(b"IEND", b"")
    return signature + ihdr_chunk + idat_chunk + iend_chunk


def _default_neovim_background_variable(theme_source: ThemeSource) -> str:
    colorscheme_name = theme_source.identifiers.nvim_colorscheme
    normalized = re.sub(r"[^a-zA-Z0-9_]", "_", colorscheme_name)
    return f"{normalized}_background"


def _default_neovim_setup_module(theme_source: ThemeSource, plugin: str | None) -> str:
    if plugin:
        repository = plugin.rsplit("/", 1)[-1]
        if repository.endswith(".nvim"):
            repository = repository[: -len(".nvim")]
        if repository:
            return repository
    return re.sub(r"[^a-zA-Z0-9_]", "_", theme_source.identifiers.nvim_colorscheme)


def _normalize_lua_identifier(source_file: Path, key_path: str, value: str) -> str:
    if not re.fullmatch(r"^[a-zA-Z_][a-zA-Z0-9_]*$", value):
        raise ThemeSourceError(
            source_file,
            f"{key_path} must match ^[a-zA-Z_][a-zA-Z0-9_]*$",
        )
    return value


def _normalize_css_identifier(source_file: Path, key_path: str, value: str) -> str:
    if not CSS_IDENTIFIER_PATTERN.fullmatch(value):
        raise ThemeSourceError(
            source_file,
            f"{key_path} must match ^[a-z0-9_-]+$",
        )
    return value


def _escape_lua_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _lua_bool(value: bool) -> str:
    return "true" if value else "false"


def _format_decimal(value: float) -> str:
    formatted = f"{value:.6f}".rstrip("0").rstrip(".")
    return formatted if formatted else "0"


def _title_case_theme_id(theme_id: str) -> str:
    return " ".join(part.capitalize() for part in theme_id.split("-"))


def _default_ghostty_header_title(theme_source: ThemeSource) -> str:
    title = theme_source.theme.name
    variant = theme_source.theme.variant
    if "-" in variant:
        suffix = variant.split("-")[-1].capitalize()
        if suffix and suffix.lower() not in title.lower():
            title = f"{title} {suffix}"
    return title


def _normalize_overrides(source_file: Path, overrides: Any) -> dict[str, dict[str, Any]]:
    if overrides is None:
        return {}
    if not isinstance(overrides, dict):
        raise ThemeSourceError(source_file, "overrides must be a TOML table")

    normalized: dict[str, dict[str, Any]] = {}
    for target, target_overrides in overrides.items():
        if target not in ALLOWED_OVERRIDE_TARGETS:
            allowed = ", ".join(sorted(ALLOWED_OVERRIDE_TARGETS))
            raise ThemeSourceError(
                source_file,
                f"overrides.{target} is not supported (allowed targets: {allowed})",
            )
        if not isinstance(target_overrides, dict):
            raise ThemeSourceError(source_file, f"overrides.{target} must be a TOML table")
        normalized[target] = _deep_copy_table(target_overrides)
    return normalized


def _deep_copy_table(table: Mapping[str, Any]) -> dict[str, Any]:
    copied: dict[str, Any] = {}
    for key, value in table.items():
        if isinstance(value, dict):
            copied[key] = _deep_copy_table(value)
        elif isinstance(value, list):
            copied[key] = _deep_copy_array(value)
        else:
            copied[key] = value
    return copied


def _deep_copy_array(values: list[Any]) -> list[Any]:
    copied: list[Any] = []
    for value in values:
        if isinstance(value, dict):
            copied.append(_deep_copy_table(value))
        elif isinstance(value, list):
            copied.append(_deep_copy_array(value))
        else:
            copied.append(value)
    return copied


def _ensure_required_keys(
    source_file: Path,
    section_name: str,
    section_data: Mapping[str, Any],
    required_keys: tuple[str, ...],
) -> None:
    missing = [key for key in required_keys if key not in section_data]
    if missing:
        missing_display = ", ".join(missing)
        raise ThemeSourceError(source_file, f"Missing required key(s) in {section_name}: {missing_display}")


def _ensure_known_keys(
    source_file: Path,
    section_name: str,
    section_data: Mapping[str, Any],
    allowed_keys: set[str],
) -> None:
    unknown = sorted(set(section_data.keys()) - allowed_keys)
    if unknown:
        unknown_display = ", ".join(unknown)
        raise ThemeSourceError(source_file, f"Unknown key(s) in {section_name}: {unknown_display}")


def _require_table(source_file: Path, data: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = data.get(key)
    if not isinstance(value, dict):
        raise ThemeSourceError(source_file, f"{key} must be a TOML table")
    return value


def _normalize_required_string(source_file: Path, key_path: str, value: Any) -> str:
    if not isinstance(value, str):
        raise ThemeSourceError(source_file, f"{key_path} must be a string")
    normalized = value.strip()
    if not normalized:
        raise ThemeSourceError(source_file, f"{key_path} must not be empty")
    return normalized


def _normalize_theme_id(source_file: Path, key_path: str, value: Any) -> str:
    normalized = _normalize_required_string(source_file, key_path, value).lower()
    if not THEME_ID_PATTERN.fullmatch(normalized):
        raise ThemeSourceError(
            source_file,
            f"{key_path} must match kebab-case pattern {THEME_ID_PATTERN.pattern}",
        )
    return normalized


def _normalize_hex_color(source_file: Path, key_path: str, value: Any) -> str:
    normalized = _normalize_required_string(source_file, key_path, value)
    if not HEX_COLOR_PATTERN.fullmatch(normalized):
        raise ThemeSourceError(source_file, f"{key_path} must match #RRGGBB")
    return normalized.lower()


def _shell_double_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\")
    escaped = escaped.replace('"', '\\"')
    escaped = escaped.replace("$", "\\$")
    escaped = escaped.replace("`", "\\`")
    return f'"{escaped}"'


if __name__ == "__main__":
    raise SystemExit(main())
