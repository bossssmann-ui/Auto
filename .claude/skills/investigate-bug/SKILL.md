---
name: investigate-bug
description: Investigates a bug conservatively before any code edits when the user wants likely causes, evidence, and the safest next step.
---

Use the analyst agent.

Task: investigate this bug without editing code.

Bug/context:
$ARGUMENTS

Rules:
- Read only relevant files
- Do not edit anything
- Identify likely causes, but distinguish evidence from hypothesis
- Separate:
  1. confirmed observations
  2. likely causes
  3. business-rule assumptions
  4. smallest safe next step
- Keep the answer short
- Treat confirmed domain facts in CLAUDE.md as authoritative

End with one of:
- Handoff ready for patcher
- Needs clarification
- Needs business verification
