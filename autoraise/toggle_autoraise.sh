#!/bin/bash

if pgrep -q "AutoRaise"; then
    killall AutoRaise
else
    /Applications/AutoRaise.app/Contents/MacOS/AutoRaise &
fi
