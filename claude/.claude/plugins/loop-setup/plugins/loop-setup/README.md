# Loop Setup

Ralph Loop scaffolding based on Geoffrey Huntley's techniques.

## What It Does

Creates specs and plans through conversation, then runs implementation in a bash loop.

## Usage

```bash
/loop-setup
/loop-setup "add user authentication"
/loop-setup "fix the login bug"
```

## The Flow

1. `/loop-setup` - brief conversation (max 5 exchanges), confirm readiness, generate files
2. Review the files, edit by hand if needed
3. New terminal, run the loop:
   ```bash
   while true; do cat prompt.md | claude --dangerously-skip-permissions; done
   ```

## Two Types of Files

| Type | File Name | Purpose | Lookup Table |
|------|-----------|---------|--------------|
| **Spec** | `[feature-name].md` | Permanent codebase documentation | Yes (indexed) |
| **Plan** | `[name]-implementation-plan.md` | Implementation checklist for the loop | No |

## What Gets Created

| Work Type | Spec | Plan | Lookup Table |
|-----------|------|------|--------------|
| Feature | `specs/[name].md` | `specs/[name]-implementation-plan.md` | Spec indexed |
| Bug fix | None | `specs/[name]-implementation-plan.md` | No |
| Refactor | Maybe | `specs/[name]-implementation-plan.md` | If spec created |

**Why no spec for bugs?** Specs document permanent codebase features. A bug fix doesn't add new functionality - it fixes something that should already work. Once fixed, there's nothing to document.

## Key Concepts

**The PIN**: Lookup table with many keywords per spec. More keywords = better search tool hit rate.

**The Dance**: Conversation creates specs. You give a seed, Claude interviews you, you give quick answers.

**Quick Conversation**: Unlike exhaustive interviews, loop-setup uses brief exchanges (max 5). When you say "I don't care" - Claude decides.

**Confirmation Checkpoint**: Before generating files, Claude shows what it understood and waits for "go". This prevents runaway exploration.

**Inline Verification**: Each file operation is verified immediately after writing.

**Fresh prompt.md**: Each feature/fix gets a fresh prompt.md. If one exists, you're asked whether to replace it.

**Two Sessions**: Spec creation is separate from implementation. Fresh context window for the loop.

**Attended First**: Watch the first iterations before letting it rip unattended.

## Why This Works (Geoffrey)

"Context windows are arrays. The less that you use in that array, the less the window needs to slide, the better outcomes you get."

"Compaction is the devil" - it's a lossy function that causes loss of the PIN.

"This context window already has one goal... create a new array" - each goal gets a fresh context.

## The PIN (Geoffrey)

"It's a lookup table... it has many different generative words to explain what each spec does. Those generative words act as... having more descriptors. That lookup table will get more hits for the search tool."

"The more it's able to find and look up that context, the less it's going to invent."

## The Dance (Geoffrey)

"Think about this is about you've got some clay on a pottery wheel and you're just like slowly making adjustments. You're molding the context window."

"It's a dance, folks. This is how you build your specifications."

## Low Control, High Oversight (Geoffrey)

"It's not high control, it's low control with high oversight."

"By it only just doing one thing in lots of loops, then each loop only has one goal, one objective."

## Attended First (Geoffrey)

"You don't just let it rip. You watch this. Well, you're watching it. I'll call out anything I notice that's a little bit weird and I'll cancel this. I'll go back and adjust my prompt."

"You don't have to immediately go into full blown Ralph. You can do it attended."

## Other Ralph Loops (Geoffrey)

"If something's wrong, that's just another Ralph loop. It's just different techniques of the Ralph loop to automate things."
