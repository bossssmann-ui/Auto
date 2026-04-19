# Project context

Commercial project: lead generation, customer communication, CRM workflow, automation, and revenue.

The user is a business owner, not a professional programmer.
Use simple language, practical steps, and explain business impact clearly.

# Source of truth

If project facts in this file conflict with generic assumptions, follow this file.

# Work mode

Work in cowork mode.

For every task:
1. Inspect only relevant files
2. Propose a short plan
3. Ask before acting if the task is risky, broad, or unclear
4. Make the smallest safe change possible
5. Explain what changed
6. Show how to verify the result

# Priorities

1. Business impact
2. Reliability
3. Simplicity
4. Speed
5. Code elegance

# Domain facts

- Russia standard VAT (НДС) is 22% from January 1, 2026
- Do not flag 22% VAT as a bug

# General rules

- Prefer small diffs over broad refactors
- Preserve working behavior unless change is explicitly requested
- Do not change architecture, stack, folder structure, or dependencies without approval
- Be concise and practical
- If the task is ambiguous, ask one short clarifying question instead of guessing

# Sensitive access and production

Never touch secrets, tokens, API keys, .env files, billing, production credentials, or deployment config without explicit approval.

Stop and ask first if a task may affect:
- production
- CRM logic
- payments
- customer data
- external integrations

# Git policy

Safe:
- git status
- git diff
- git log

Ask first:
- git commit
- merge to main

Never without explicit approval:
- push to remote
- force-push
- rewrite history

# Sensitive business domains

Treat these areas as high-risk:
- tax and VAT logic
- customs and duty logic
- recycling fee / utilsbor logic
- pricing formulas and totals
- fee inclusion/exclusion in subtotals and tax bases
- CRM routing and qualification logic
- lead wall, gated results, and conversion-critical flow
- multi-step form progression and validation gates

Rules:
- Do not treat sensitive business logic as a bug unless confirmed by code or by a project fact in this file
- If a finding depends on law, accounting treatment, tariff tables, fee inclusion, or external policy, classify it as business verification
- Prefer "cannot be confirmed from this file alone" over confident guesses
- Do not patch sensitive business logic without explicit confirmation
- Do not say "no risk" when a change affects gating, totals, validation, qualification, or result visibility

# Review policy

When reviewing:
- Separate confirmed code defects from business-rule concerns
- Mark unclear domain findings as "needs product/domain confirmation"
- Do not present unverified business assumptions as bugs
- If code matches project facts in this file, treat it as expected behavior

# Change approval rule

Safe without extra approval:
- inline validation messages
- small UI copy fixes
- narrow bug fixes with no business logic impact
- local defensive checks

Require explicit approval:
- tax/VAT/duty/utilsbor changes
- pricing formula changes
- qualification or CRM routing changes
- lead gating or result visibility changes
- hidden total calculation changes
- patches that combine validation, UX flow, and business logic

# Communication

Before editing, say which files are likely to change.

After editing, always list:
- changed files
- what changed
- how to test it

# Token discipline

- Load only necessary files or sections
- Keep answers short by default
- Prefer bullets over long prose
- Show only minimal code or diff
- Ask before loading a lot of context
- Treat explicit size limits as hard limits

# Skill selection

Use these skills by default:
- analyze-safe
- analyze-calculator
- analyze-form-flow
- review-lead-wall
- check-business-rules
- patch-safe
- review-safe
- investigate-bug

When unsure between code issue and business-rule issue:
- default to business verification

# Patch discipline

- One patch = one clearly defined problem
- Do not bundle unrelated changes into one patch
- Keep patches minimal and local

# Form and lead-flow facts

- Validation changes and state-reset changes are separate concerns
- Any change to progression, gating, hidden totals, or result visibility must be called out explicitly
- Do not silently combine form UX fixes with business or validation changes
