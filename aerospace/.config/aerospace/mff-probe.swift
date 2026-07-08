// Probe for mouse-follows-focus.sh. Prints: <epoch-now> <mouse-idle-secs> <x> <y>
// idle = seconds since the last mouse move/drag in the HID event state. Real
// input AND posted .mouseMoved CGEvents (aerospace move-mouse warps) count;
// CGWarpMouseCursorPosition (AutoRaise warps) does not. mouse-follows-focus.sh
// therefore timestamps its own executed warps to tell them apart from a hand
// on the mouse. Compiled on demand by mouse-follows-focus.sh into ~/.local/bin.
import CoreGraphics
import Foundation

let types: [CGEventType] = [.mouseMoved, .leftMouseDragged, .rightMouseDragged]
let idle = types.map { CGEventSource.secondsSinceLastEventType(.hidSystemState, eventType: $0) }.min()!
let p = CGEvent(source: nil)!.location
print(String(format: "%.3f %.3f %.1f %.1f", Date().timeIntervalSince1970, idle, p.x, p.y))
