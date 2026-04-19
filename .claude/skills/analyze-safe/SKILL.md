---
name: analyze-safe
description: Conservatively analyzes business-sensitive code in read-only mode when the user wants a short safe review without edits, especially for pricing, tax, CRM, lead-flow, or formula logic.
---

Use the analyst agent.

Task: analyze $ARGUMENTS only.
Do not edit anything.

Rules:
- Be conservative
- Keep the answer short
- Separate:
  1. clear code issues
  2. business-rule assumptions
  3. smallest safe next step
- Do not label tax, customs, pricing, CRM logic, formulas, lead routing, qualification logic, or business-rule assumptions as confirmed bugs unless they can be confirmed from the file alone or from CLAUDE.md
- If a logic mismatch could plausibly come from regulation tables, tariff simplification, age buckets, fee tables, external policy rules, or accounting treatment, classify it as business-rule verification, not a confirmed code bug
- If a finding depends on whether a tax base, tariff base, fee inclusion, or regulatory formula is correct, classify it as business-rule verification, not a clear code issue
- Treat confirmed domain facts in CLAUDE.md as authoritative
- If something looks unusual but may be intentional, say so
- Prefer high-impact user-facing risks over theoretical issues

End with one of:
- Handoff ready for patcher
- Needs clarification
- Needs business verification
