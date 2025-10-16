# SketchyBar Config

This directory mirrors `~/.config/sketchybar` so the installer can symlink everything back into place on a fresh machine.

- `sketchybarrc` sets the bar position (`top`), height (`40`), blur, colors, and populates default mission-control, app, and status items.
- `plugins/` contains the helper scripts referenced by the config (clock, volume, battery, front_app, space indicators).

## Deploy

```bash
ln -sfn "$DOTFILES_DIR/sketchybar" "$HOME/.config/sketchybar"
sketchybar --reload
```

## Rectangle integration

Pair this setup with Rectangle margins so tiled windows stop below the custom bar:

```bash
defaults write com.knollsoft.Rectangle screenEdgeGapTop -int 40          # external displays
defaults write com.knollsoft.Rectangle screenEdgeGapTopNotch -int 18     # MacBook notch
```

Undo the gap if you switch bars:

```bash
defaults delete com.knollsoft.Rectangle screenEdgeGapTop
defaults delete com.knollsoft.Rectangle screenEdgeGapTopNotch
```
