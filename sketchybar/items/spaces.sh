#!/usr/bin/env bash

sketchybar --add event aerospace_workspace_change

declare -A WORKSPACE_MONITORS
for mon in {1..3}; do
  workspace_ids="$(aerospace list-workspaces --monitor "$mon" 2>/dev/null)"
  for ws in $workspace_ids; do
    WORKSPACE_MONITORS["$ws"]=$mon
  done
done

monitor_list="$(aerospace list-monitors 2>/dev/null)"

# Check if this is laptop-only mode (only built-in monitor)
is_laptop_only=false
monitor_count=$(echo "$monitor_list" | wc -l)
if [ "$monitor_count" -eq 1 ] && echo "$monitor_list" | grep -q "Built-in"; then
  is_laptop_only=true
fi

for i in {1..9}; do
  sid=$i

  # Dynamically determine which monitor this workspace belongs to
  monitor_id="${WORKSPACE_MONITORS[$sid]}"

  # Detect setup by checking monitor names
  # Auto-detect Work vs Home vs Laptop-only setup
  display_id=""
  if [ "$is_laptop_only" = true ]; then
    # Laptop-only setup - all workspaces on single display
    display_id=1
  elif echo "$monitor_list" | grep -q "LG ULTRAWIDE"; then
    # Work/Office setup - swapped displays 2 and 3
    case $monitor_id in
      1) display_id=1 ;;  # LG ULTRAWIDE (workspaces 1-4)
      2) display_id=3 ;;  # Built-in Retina Display (workspaces 5-8)
      3) display_id=2 ;;  # ASUS VA24E (workspace 9)
    esac
  else
    # Home setup - swapped mapping for BenQ/Pixio
    case $monitor_id in
      1) display_id=2 ;;  # BenQ XL2411Z (workspaces 1-4)
      2) display_id=1 ;;  # Pixio PX248PS (workspaces 5-8)
      3) display_id=3 ;;  # Built-in Retina Display (workspaces 9 and 0)
    esac
  fi

  space=(
    space="$sid"
    display="$display_id"
    icon="$sid"
    icon.color=$WORKSPACE_ICON_INACTIVE
    icon.highlight_color=$WORKSPACE_ICON_ACTIVE
    icon.padding_left=6
    icon.padding_right=0
    ignore_association=off
    click_script="aerospace workspace $sid"
    script="$PLUGIN_DIR/space_hover.sh"
    label.padding_right=10
    label.color=$GREY
    label.highlight_color=$ICON_COLOR
    label.font="sketchybar-app-font:Regular:14.0"
    label.y_offset=-1
    background.color=$TRANSPARENT
    background.border_color=$TRANSPARENT
  )

  sketchybar --add space space.$sid left \
             --set space.$sid "${space[@]}" \
             --subscribe space.$sid mouse.entered mouse.exited
done

# Add workspace 0 separately (appears after workspace 9 on Built-in display)
sid=0
monitor_id="${WORKSPACE_MONITORS[$sid]}"

display_id=""
if [ "$is_laptop_only" = true ]; then
  display_id=1
elif echo "$monitor_list" | grep -q "LG ULTRAWIDE"; then
  # Work/Office setup
  case $monitor_id in
    1) display_id=1 ;;
    2) display_id=3 ;;
    3) display_id=2 ;;
  esac
else
  # Home setup - workspace 0 on Built-in (monitor 3 → display 3)
  case $monitor_id in
    1) display_id=2 ;;
    2) display_id=1 ;;
    3) display_id=3 ;;
  esac
fi

space=(
  space="$sid"
  display="$display_id"
  icon="$sid"
  icon.color=$WORKSPACE_ICON_INACTIVE
  icon.highlight_color=$WORKSPACE_ICON_ACTIVE
  icon.padding_left=6
  icon.padding_right=0
  ignore_association=off
  click_script="aerospace workspace $sid"
  script="$PLUGIN_DIR/space_hover.sh"
  label.padding_right=10
  label.color=$GREY
  label.highlight_color=$ICON_COLOR
  label.font="sketchybar-app-font:Regular:14.0"
  label.y_offset=-1
  background.color=$TRANSPARENT
  background.border_color=$TRANSPARENT
)

sketchybar --add space space.$sid left \
           --set space.$sid "${space[@]}" \
           --subscribe space.$sid mouse.entered mouse.exited


space_separator=(
  icon=􀆊
  icon.font="$FONT:Black:14.0"
  padding_left=10
  padding_right=8
  label.drawing=off
  icon.color=$ICON_COLOR
)

sketchybar --add item space_separator left               \
           --set space_separator "${space_separator[@]}"

workspace_controller=(
  drawing=off
  updates=on
  script="$PLUGIN_DIR/space_windows.sh"
)

sketchybar --add item aerospace_workspace_controller left \
           --set aerospace_workspace_controller "${workspace_controller[@]}" \
           --subscribe aerospace_workspace_controller aerospace_workspace_change

sketchybar --trigger aerospace_workspace_change
