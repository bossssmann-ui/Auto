---
name: review-lead-wall
description: Reviews lead-wall and gated-result changes when the code controls result visibility, lead capture, validation, or conversion-critical gating.
---

Use the reviewer agent.

Task: review the recent lead-wall or gated-result change in $ARGUMENTS.

Check:
- whether the patch stayed in scope
- whether total or result visibility changed
- whether lead capture gating changed
- whether validation or step progression changed
- whether any CRM, qualification, or routing logic changed
- whether the patch could reduce conversion or leak gated information early
- whether the patch is minimal and safe

Rules:
- Keep the answer short
- Do not say "no risk" if gating, validation, progression, or result visibility changed
- Distinguish:
  - acceptable change
  - scope drift
  - conversion risk
  - business-risk change
- Treat confirmed domain facts in CLAUDE.md as authoritative

End with one of:
- Approved
- Approved with caution
- Changes requested
