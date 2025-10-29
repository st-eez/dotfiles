#!/bin/sh

#SPACE_ICONS=("1" "2" "3" "4")

# Destroy space on right click, focus space on left click.
# New space by left clicking separator (>)

sketchybar --add event aerospace_workspace_change
#echo $(aerospace list-workspaces --monitor 1 --visible no --empty no) >> ~/aaaa

for i in {1..9}; do
  sid=$i

  # Dynamically determine which monitor this workspace belongs to
  monitor_id=""
  for mon in {1..3}; do
    if aerospace list-workspaces --monitor $mon | grep -q "^${sid}$"; then
      monitor_id=$mon
      break
    fi
  done

  # Detect setup by checking monitor names
  # Auto-detect Work vs Home setup
  display_id=""
  if aerospace list-monitors | grep -q "LG ULTRAWIDE"; then
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
      2) display_id=1 ;;  # Pixio PX248PS (workspace 9)
      3) display_id=3 ;;  # Built-in Retina Display (workspaces 5-8)
    esac
  fi

  space=(
    space="$sid"
    display="$display_id"
    icon="$sid"
    icon.color=$ICON_COLOR
    icon.highlight_color=$RED
    icon.padding_left=10
    icon.padding_right=0
    ignore_association=off
    padding_left=2
    padding_right=2
    label.padding_right=20
    label.color=$GREY
    label.highlight_color=0xffbb9af7
    label.font="sketchybar-app-font:Regular:14.0"
    label.y_offset=-1
    background.color=0x00000000
    background.border_color=0x00000000
  )

  sketchybar --add space space.$sid left \
             --set space.$sid "${space[@]}"
done


space_creator=(
  icon=􀆊
  icon.font="$FONT:Heavy:12.0"
  padding_left=10
  padding_right=8
  label.drawing=off
  icon.color=0xffbb9af7
)

sketchybar --add item space_creator left               \
           --set space_creator "${space_creator[@]}"

workspace_controller=(
  drawing=off
  updates=on
  script="$PLUGIN_DIR/space_windows.sh"
)

sketchybar --add item aerospace_workspace_controller left \
           --set aerospace_workspace_controller "${workspace_controller[@]}" \
           --subscribe aerospace_workspace_controller aerospace_workspace_change

sketchybar --trigger aerospace_workspace_change
