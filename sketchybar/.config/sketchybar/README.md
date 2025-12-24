# Dependencies

- SketchyBar (runtime) – install via `brew install --cask sketchybar` → https://felixkratz.github.io/SketchyBar/setup/installation
- AeroSpace (workspace metadata) – `brew install --cask nikitabobko/tap/aerospace` → https://nikitabobko.github.io/AeroSpace/installation
- SwitchAudioSource (`switchaudio-osx`, audio picker) – `brew install switchaudio-osx` → https://github.com/deweller/switchaudio-osx

**Permissions:** give SketchyBar Automation + Accessibility access under System Settings ▸ Privacy & Security ▸ Automation/Accessibility so the Control Center scripts and AeroSpace hooks work.

## Keyboard repeat tweaks

- System Settings ▸ Keyboard sliders: set **Key Repeat Rate** to Fast (`KeyRepeat = 2`) and **Delay Until Repeat** to Short (`InitialKeyRepeat = 15`) to match Apple’s documented maximums (see [Apple Support](https://support.apple.com/guide/mac-help/change-keyboard-preferences-mchlp1383/mac)).
- For faster-than-UI behavior, run `defaults write -g KeyRepeat -int 1` and `defaults write -g InitialKeyRepeat -int 5`, then `killall Dock` (or log out/in) to apply.
- Revert anytime with `defaults delete -g KeyRepeat` / `defaults delete -g InitialKeyRepeat` or by touching the sliders again.
