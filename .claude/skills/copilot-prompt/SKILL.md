---
name: copilot-prompt
description: Generate a short, high-quality GitHub Copilot prompt from the current task and relevant files.
---

Use this skill when the user wants a prompt for GitHub Copilot instead of direct editing.

Rules:
- Read only the files explicitly mentioned in the task
- Extract the minimum necessary architectural context
- Include constraints from CLAUDE.md when relevant
- Generate a prompt for Copilot that is short, specific, and safe
- Keep the final prompt under 200 words
- Do not explain the prompt unless the user asks

Output format:
1. Copilot prompt
2. Files to attach/reference
3. What Copilot must not do
