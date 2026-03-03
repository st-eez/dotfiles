#!/usr/bin/env python3
"""Core loader/model for canonical theme TOML sources."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping
import re
import tomllib

THEME_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")

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


def default_sources_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "sources"


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


def load_theme_source_by_id(theme_id: str, sources_dir: str | Path | None = None) -> ThemeSource:
    normalized_theme_id = _normalize_theme_id(
        source_file=Path("<input>"),
        key_path="theme_id",
        value=theme_id,
    )
    resolved_sources_dir = Path(sources_dir).resolve() if sources_dir else default_sources_dir()
    return load_theme_source(resolved_sources_dir / f"{normalized_theme_id}.toml")


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
