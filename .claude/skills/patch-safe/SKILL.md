---
name: patch-safe
description: Applies a minimal safe patch in explicitly approved files when the user wants a small controlled edit without unrelated refactoring.
---

Use the patcher agent.

Task: make the requested minimal safe change.

Approved target:
$ARGUMENTS

Rules:
- Edit only explicitly approved files
- Keep the patch as small as possible
- Do not refactor unrelated code
- Do not rename files, move files, or reorganize folders unless explicitly requested
- Do not change tax, customs, pricing, CRM routing, lead flow, formulas, or sensitive business logic unless explicitly requested and confirmed
- Treat confirmed domain facts in CLAUDE.md as authoritative
- If the request is ambiguous, stop instead of guessing

After editing, report:
- changed files
- what changed
- risks or follow-ups
- how to test
