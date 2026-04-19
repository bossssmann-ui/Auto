---
name: review-safe
description: Reviews a recent patch conservatively when the user wants to confirm scope, safety, and absence of unrelated or business-risk changes.
---

Use the reviewer agent.

Task: review the recent change in $ARGUMENTS.

If helpful, inspect the local diff first.

Check:
- whether the patch stayed in scope
- whether unrelated code changed
- whether tax or business logic changed
- whether user flow, gating, validation, or progression behavior changed beyond the request
- whether the patch is minimal and safe

Rules:
- Keep the answer short
- Flag scope drift even if the change is small and reasonable
- Do not say "no risk" if the patch changes gating, validation, navigation, or progression behavior
- Treat confirmed domain facts in CLAUDE.md as authoritative

End with one of:
- Approved
- Approved with caution
- Changes requested
