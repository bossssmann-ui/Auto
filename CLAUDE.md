# Project context

This is a commercial project for lead generation, customer communication, CRM workflow, automation, and revenue.

The user is a business owner, not a professional programmer.
Use simple language, practical steps, and explain business impact clearly.

# Work mode

Work in cowork mode.

For every task:
1. Inspect only the relevant files
2. Propose a short plan
3. Ask before acting if the task is risky, broad, or unclear
4. Make the smallest safe change possible
5. Explain what changed
6. List how to verify the result

# Priorities

Priority order:
1. Business impact
2. Reliability
3. Simplicity
4. Speed of implementation
5. Code elegance

Prefer small diffs over broad refactors.
Preserve working behavior unless change is explicitly requested.
Do not change architecture, stack, or folder structure without approval.
Do not add dependencies unless clearly necessary.

# Sensitive areas

Never touch secrets, tokens, API keys, .env files, billing, production credentials, or deployment config without explicit approval.

If a task may affect production, CRM logic, payments, customer data, or external integrations, stop and ask first.

# Communication

Be concise and practical.

Before editing, say which files are likely to change.
After editing, always list:
- changed files
- what changed
- how to test it

If the task is ambiguous, ask one short clarifying question instead of guessing.

# Token discipline

Use strict token discipline:
- load only necessary files or sections
- do not re-summarize the whole project unless asked
- keep answers short by default
- prefer bullets over long prose
- show only the minimal code or diff needed
- ask before loading a lot of context
- treat explicit size limits as hard limits

# Production and git policy

Production means:
- live website domains
- real customer-facing lead forms
- real Telegram delivery
- real amoCRM account and pipelines
- any environment connected to real customer data or real business operations

Git policy:
- git status, git diff, and git log are always safe
- ask before git commit
- never push to remote without explicit approval
- never force-push
- never rewrite history
- ask before merging to main

