// profile-watcher — dumb display-reconfiguration trigger for apply-profile.sh.
//
// Coalesces macOS's multi-callback reconfiguration bursts (a dock connect
// spreads several callbacks over seconds) behind a settle timer, then spawns
// the reconciler in its own session so a downstream `sketchybar --reload` or
// aerospace restart can never signal back into this process. All profile
// policy lives in apply-profile.sh; this binary only debounces and execs.
//
// Event source is AppKit's didChangeScreenParametersNotification: verified
// live that bare CGDisplayRegisterReconfigurationCallback callbacks are NOT
// delivered to a faceless CFRunLoop daemon — they need the WindowServer
// connection NSApplication establishes. The CG callback stays registered as
// a second source; both just re-arm the same settle timer, so duplicates
// coalesce. Spurious AppKit notifications (e.g. dock visibility) are cheap:
// the reconciler no-ops unless the display topology actually changed.
//
// The 120s poll is the dropped-event/wake safety net and must live
// in-process: launchd StartInterval firings are skipped while the job is
// running and during sleep, so they cannot serve as a poll for a KeepAlive
// daemon.

import AppKit
import Darwin
import Foundation

let settleSeconds = 1.5
let pollSeconds = 120.0
let reconciler = NSHomeDirectory() + "/.config/aerospace/apply-profile.sh"

func note(_ msg: String) {
    FileHandle.standardError.write(Data(("profile-watcher: " + msg + "\n").utf8))
}

func spawnReconciler(_ reason: String) {
    var attr: posix_spawnattr_t?
    posix_spawnattr_init(&attr)
    defer { posix_spawnattr_destroy(&attr) }
    // Own session: no process-group tie back to this daemon. /usr/bin/setsid
    // does not exist on macOS, so detach in-process.
    posix_spawnattr_setflags(&attr, Int16(POSIX_SPAWN_SETSID))

    var pid: pid_t = 0
    var argv: [UnsafeMutablePointer<CChar>?] = [
        strdup("/bin/bash"), strdup(reconciler), strdup(reason), nil,
    ]
    defer { argv.forEach { free($0) } }

    let rc = posix_spawn(&pid, "/bin/bash", nil, &attr, &argv, environ)
    if rc == 0 {
        note("reconciler spawned pid=\(pid) reason=\(reason)")
    } else {
        note("posix_spawn failed rc=\(rc) reason=\(reason)")
    }
}

var settleTimer: Timer?

func armSettleTimer(_ source: String) {
    note("display change (\(source)) — settling \(settleSeconds)s")
    settleTimer?.invalidate()
    settleTimer = Timer.scheduledTimer(withTimeInterval: settleSeconds, repeats: false) { _ in
        spawnReconciler("display-event")
    }
}

// Fire-and-forget children are reaped by the kernel, never zombies.
signal(SIGCHLD, SIG_IGN)

let app = NSApplication.shared
app.setActivationPolicy(.prohibited) // no Dock icon, no UI

NotificationCenter.default.addObserver(
    forName: NSApplication.didChangeScreenParametersNotification,
    object: nil, queue: .main
) { _ in
    armSettleTimer("appkit")
}

let cgError = CGDisplayRegisterReconfigurationCallback(
    { _, flags, _ in
        // Begin-phase callbacks fire before display state is updated; only
        // post-reconfiguration callbacks restart the settle window.
        if flags.contains(.beginConfigurationFlag) { return }
        DispatchQueue.main.async { armSettleTimer("cg") }
    }, nil)
if cgError != .success {
    note("CG callback registration failed rc=\(cgError.rawValue) — AppKit source only")
}

DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
    spawnReconciler("startup")
}

Timer.scheduledTimer(withTimeInterval: pollSeconds, repeats: true) { _ in
    spawnReconciler("poll")
}

note("watching display configuration (settle \(settleSeconds)s, poll \(Int(pollSeconds))s)")
app.run()
