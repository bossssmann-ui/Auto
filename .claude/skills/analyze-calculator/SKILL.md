---
name: analyze-calculator
description: Analyzes calculators conservatively when the code contains totals, tariffs, fees, age buckets, branching logic, or business-sensitive calculation paths such as import cost, VAT, duties, or recycling fees.
---

Use the analyst agent.

Task: analyze $ARGUMENTS only.
Do not edit anything.

Focus on:
- calculation flow
- branching by product, vehicle, owner, or user type
- input validation
- hidden assumptions in totals
- mismatches between UI labels and calculation paths
- stale state, default fallbacks, and silent wrong results
- places where subtotal and taxable base may be different concepts

Rules:
- Be conservative
- Keep the answer short
- Separate:
  1. clear code issues
  2. business-rule assumptions
  3. highest-impact user-facing risk
- Do not label tax, customs, tariff tables, duty formulas, recycling fee tables, VAT base/rates, fee inclusion, or regulatory buckets as confirmed bugs unless they can be confirmed from the file alone or from CLAUDE.md
- If a logic mismatch could plausibly come from tariff simplification, regulation tables, age buckets, fee tables, accounting treatment, or policy rules, classify it as business verification, not a confirmed bug
- Treat confirmed domain facts in CLAUDE.md as authoritative
- Call out silent wrong-result risks before cosmetic issues
- If a result may be numerically wrong because of stale state, bad defaults, or weak validation, prioritize that over speculative regulatory concerns

End with one of:
- Handoff ready for patcher
- Needs clarification
- Needs business verification
