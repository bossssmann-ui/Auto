---
name: check-business-rules
description: Identifies business-rule assumptions before patching when the code involves taxes, tariffs, fees, formulas, qualification logic, or routing logic.
---

Use the analyst agent.

Task: inspect $ARGUMENTS for business-rule assumptions only.
Do not edit anything.

Focus on:
- tax and VAT logic
- customs and duty logic
- tariff and fee tables
- recycling fee or utilsbor logic
- qualification rules
- CRM routing or lead handling
- total composition
- hidden assumptions in formulas and condition branches

Rules:
- Keep the answer short
- Do not list normal code issues unless they directly affect business-rule interpretation
- For each finding, classify it as:
  - confirmed by CLAUDE.md
  - cannot be confirmed from code alone
  - likely needs business verification
- Prefer caution over certainty
- If the code may be correct under one plausible policy interpretation, say so
- Do not recommend edits unless the rule is confirmed

End with:
- Safe to patch
or
- Do not patch before business verification
