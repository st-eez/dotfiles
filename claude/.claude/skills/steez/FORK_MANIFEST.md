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
| steez-autoplan/SKILL.md | autoplan/SKILL.md | Steez porting recipe (see ARCHITECTURE.md) |
| steez-browse/SKILL.md | browse/SKILL.md | Rebuilt: merged gstack-browse + playwright-cli into single Bun binary |
| steez-canary/SKILL.md | canary/SKILL.md | Same pattern |
| steez-codex/SKILL.md | codex/SKILL.md | Same pattern |
| steez-cso/SKILL.md | cso/SKILL.md | Same pattern |
| steez-design-consultation/SKILL.md | design-consultation/SKILL.md | Same pattern |
| steez-design-review/SKILL.md | design-review/SKILL.md | Same pattern |
| steez-design-shotgun/SKILL.md | design-shotgun/SKILL.md | Same pattern |
| steez-document-release/SKILL.md | document-release/SKILL.md | Same pattern |
| steez-investigate/SKILL.md | investigate/SKILL.md | Same pattern |
| steez-land-and-deploy/SKILL.md | land-and-deploy/SKILL.md | Same pattern |
| steez-office-hours/SKILL.md | office-hours/SKILL.md | Voice identity, path refs, dead code stripped, Skill Self-Report |
| steez-plan-ceo-review/SKILL.md | plan-ceo-review/SKILL.md | Same pattern |
| steez-plan-design-review/SKILL.md | plan-design-review/SKILL.md | Same pattern |
| steez-plan-eng-review/SKILL.md | plan-eng-review/SKILL.md | Same pattern |
| steez-qa/SKILL.md | qa/SKILL.md | Same pattern |
| steez-qa-only/SKILL.md | qa-only/SKILL.md | Same pattern |
| steez-retro/SKILL.md | retro/SKILL.md | Same pattern |
| steez-review/SKILL.md | review/SKILL.md | Same pattern |
| steez-setup-deploy/SKILL.md | setup-deploy/SKILL.md | Same pattern |
| steez-ship/SKILL.md | ship/SKILL.md | Same pattern |

## Other
| File | Source | Notes |
|------|--------|-------|
| ETHOS.md | gstack/ETHOS.md | Unmodified copy |
