#!/bin/bash

if pgrep -q "AutoRaise"; then
    killall AutoRaise
else
    # brew formula binary; no args so it reads ~/.config/AutoRaise/config
    /opt/homebrew/opt/autoraise/bin/AutoRaise &
fi
