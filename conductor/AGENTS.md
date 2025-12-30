# CONDUCTOR KNOWLEDGE BASE

## OVERVIEW

Project management system tracking dotfiles evolution via plans, specs, and phase-based workflows.

## WHERE TO LOOK

| Task              | Location                | Notes                                      |
| :---------------- | :---------------------- | :----------------------------------------- |
| Track roadmap     | `tracks.md`             | Feature tracks and major milestones        |
| View active work  | `PLAN-*.md`             | Active implementation plans in root        |
| Check tech stack  | `tech-stack.md`         | Architecture decisions and approved tools  |
| Verify workflow   | `workflow.md`           | Commit conventions and phase protocol      |
| Reference history | `archive/`              | Completed plans with checkpoints           |
| UI/UX rules       | `product-guidelines.md` | Design principles for installer/extensions |

## WORKFLOW

1. **Plan**: Define task in `PLAN-*.md` before coding.
2. **In-Progress**: Update marker `[ ]` → `[~]` before starting.
3. **Implement**: Minimum code to satisfy task requirements.
4. **Verify**: Run tests/dry-runs per task definition.
5. **Complete**: Update marker `[~]` → `[x]`.
6. **Phase Exit**: Execute verification protocol + manual validation.
7. **Checkpoint**: Commit phase changes (`feat(<scope>): Complete Phase X`) + record SHA in plan.

## ANTI-PATTERNS

- **Planless coding**: Implementing features without a corresponding plan task.
- **Micro-commits**: Committing per-task instead of grouping by phase.
- **Missing checkpoints**: Neglecting to append `[checkpoint: <sha>]` to phase headers.
- **Late tech updates**: Modifying `tech-stack.md` during implementation (document design _first_).
- **Silent deviations**: Changing design without updating specs/plans.
