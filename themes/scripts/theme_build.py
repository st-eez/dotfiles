#!/usr/bin/env python3
"""Core loader/model for canonical theme TOML sources."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
from pathlib import Path
import re
import sys
import tomllib
from typing import Any, Mapping, Sequence, TextIO

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
    ]
    if sum(selected_modes) > 1:
        parser.error("--check, --generate-meta, and --generate-themes-json are mutually exclusive")

    if args.check:
        return run_check_mode(args.sources_dir)
    if args.generate_meta:
        return run_generate_meta_mode(args.sources_dir, args.meta_dir)
    if args.generate_themes_json:
        return run_generate_themes_json_mode(args.sources_dir, args.themes_json_path)
    parser.print_help(sys.stderr)
    return 2


def _extract_theme_source_error_message(error: ThemeSourceError) -> str:
    raw_message = str(error)
    prefix = f"{error.source_file}: "
    if raw_message.startswith(prefix):
        return raw_message[len(prefix) :]
    return raw_message


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
