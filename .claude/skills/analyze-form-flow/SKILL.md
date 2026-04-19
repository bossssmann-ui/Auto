---
name: analyze-form-flow
description: Reviews multi-step forms and validation flow when the user wants to inspect progression logic, required fields, gating, and conversion-critical UX.
---

Use the analyst agent.

Task: analyze the form flow in $ARGUMENTS only.
Do not edit anything.

Focus on:
- step progression
- button enable/disable logic
- validation timing
- inline errors vs silent failures
- required fields
- state persistence between steps
- hidden branches by user type or vehicle type
- places where user inputs can produce confusing or wrong outcomes

Rules:
- Keep the answer short
- Be conservative
- Prioritize conversion-critical and data-quality risks
- Distinguish:
  - clear UX/code issues
  - likely UX friction
  - business-rule assumptions
- Flag if progression, validation, or gating depends on fragile derived state
- Do not classify lead policy, CRM routing, qualification rules, or intentional sales gating as bugs unless clearly contradicted by the code or CLAUDE.md
- Treat confirmed domain facts in CLAUDE.md as authoritative

End with:
- most likely user-facing break
- smallest safe next step
