# Fork Manifest
Upstream: https://github.com/garrytan/gstack.git
Forked at: 2026-03-29
Upstream version: 0.13.0.0

## Scripts (from gstack bin/)
| File | Upstream source | Patches |
|------|----------------|---------|
| steez-config | bin/gstack-config | Renamed, STATE_DIR → ~/.steez/ |
| steez-slug | bin/gstack-slug | Renamed, added empty slug fallback |
| steez-review-log | bin/gstack-review-log | Renamed, GSTACK_HOME → ~/.steez/, internal calls renamed |
| steez-review-read | bin/gstack-review-read | Renamed, GSTACK_HOME → ~/.steez/, internal calls renamed |
| steez-diff-scope | bin/gstack-diff-scope | Renamed only |

## Skills (from gstack skill dirs/)
| File | Upstream source | Patches |
|------|----------------|---------|
| steez-office-hours/SKILL.md | office-hours/SKILL.md | Voice identity, path refs, dead code stripped, Skill Self-Report |
| steez-plan-ceo-review/SKILL.md | plan-ceo-review/SKILL.md | Same pattern |
| steez-plan-eng-review/SKILL.md | plan-eng-review/SKILL.md | Same pattern |
| steez-review/SKILL.md | review/SKILL.md | Same pattern |
| steez-ship/SKILL.md | ship/SKILL.md | Same pattern |

## Other
| File | Source | Notes |
|------|--------|-------|
| ETHOS.md | gstack/ETHOS.md | Unmodified copy |
