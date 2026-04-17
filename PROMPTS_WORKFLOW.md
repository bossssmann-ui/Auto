# Claude Code — рабочие промпты для AUTO-1

Эти шаблоны нужны, чтобы работать с Claude Code экономно по токенам и предсказуемо по поведению.

---

## 1. Безопасный анализ (ничего не менять)

**Для чего:** когда нужно сначала понять проблему или кусок проекта, но НЕЛЬЗЯ ничего править.

```text
Work in cowork mode.

Do not edit anything.

Analyze this issue:
[опиши одну конкретную задачу или проблему]

Rules:
- focus only on relevant files
- do not restate the whole project
- keep the answer short (max 10 bullets)

Please:
1. explain the issue in simple language
2. list the risks or missing information
3. propose a short safe plan (3–5 steps max)

Wait for my approval before making any changes.


2. Маленький безопасный патчкогда уже понятна проблема и нужно сделать МИНИМАЛЬНОЕ исправление.
Work in cowork mode.

Task:
[одна конкретная правка — не “сделай всё”]

Rules:
- inspect only the necessary files
- make the smallest safe change possible
- do not refactor unrelated code
- do not add new dependencies unless clearly needed
- keep the answer short (3–7 bullets)
- show only the code that must be changed, not full files

Before editing:
- tell me which files you plan to modify and your short plan

After editing, tell me:
1. which files changed
2. what changed (short)
3. how to test it (3–5 steps)

Wait for my approval before making any changes if the plan looks risky or too broad.

3. Проверка уже сделанных изменений
Для чего: перед коммитом или перед тем, как показать результат

Review the current uncommitted changes in cowork mode.

Please:
- summarize what changed, file by file
- identify any risks, regressions, or unnecessary edits
- check whether the changes match the intended task:
  “[своими словами напомни задачу]”
- point out anything that should be reverted or simplified
- do not modify files

Keep the answer concise (max 10 bullets).

4. Аудит lead flow (лиды с сайта → Telegram → amoCRM)
Для чего: когда нужно проверить, не теряются ли заявки и где слабые места.

Work in cowork mode.

Do not edit anything.

Analyze only the lead flow in AUTO-1:

- frontend forms (Calculator, LeadMagnet, ExitIntent)
- submitLead() in src/api.ts
- /api/lead in server/index.ts and server/lead.ts
- Telegram notification
- amoCRM lead creation

Please:
1. explain how a lead moves from the website to Telegram and amoCRM
2. list where leads can be lost or silently fail
3. list what can hurt conversions (too much friction, bad errors, etc.)
4. propose the smallest safe fixes in priority order

Keep the answer short (max 12 bullets).
Wait for my approval before making any changes.

5. Аудит бота (OpenRouter + калькулятор)
Для чего: когда нужно проверить конфигурацию бота и модели, не трогая код.

Work in cowork mode.

Do not edit anything.

Analyze the AI bot in AUTO-1:

Focus on:
- server/bot.ts
- OpenRouter model configuration
- how the calculator is used inside the bot

Please:
1. explain how the bot currently works (high-level)
2. check the model name and OpenRouter usage for obvious misconfigurations
3. list risks: failures, bad error handling, rate limits, token usage problems
4. propose the smallest safe improvements in priority order

Keep the answer brief (max 10 bullets).
Wait for my approval before making any changes.

6. Короткая диагностика ошибки
Для чего: когда “что‑то не работает”, и нужно, чтобы Claude помог быстро найти причину

Work in cowork mode.

Do not edit anything yet.

I have a problem:
[опиши симптомы — что именно не работает, ошибка, скрин, логи]

Please:
1. guess the most likely causes based on the code
2. list the exact commands I should run in the terminal to diagnose it (step by step)
3. propose a minimal fix plan

Keep it short (max 10 bullets).
Wait for my approval before making any changes.

7. Экономный запрос по конкретному файлу
Для чего: когда нужно, чтобы он посмотрел только один файл/функцию и не тянул контекст.

Work in cowork mode.

Focus ONLY on this file:
[путь к файлу, например: src/components/Calculator.tsx]

Task:
[что именно надо сделать или понять в этом файле]

Rules:
- do not load any other files unless I explicitly ask
- keep the answer short (max 8 bullets)
- if you think other files are needed, ask me first

Do not edit anything.

8. Переформулировать мой текст для Claude Code
Для чего: когда ты не уверен, как красиво/правильно написать задачу.

You are my prompt editor for Claude Code.

Task:
I will describe in Russian what I want Claude Code to do.
Please:
1. rewrite it as a clear, concise English prompt
2. keep it focused on cowork mode and small safe changes
3. add explicit limits on answer length and scope

Do not solve the task itself, only rewrite my instructions.

Here is my raw description:
[свой текст по-русски]


9

Этот файл можно держать в проекте и открывать в VS Code рядом с чатом Claude Code; ты просто копируешь нужный блок, вставляешь в Claude, дописываешь задачу — и всё.

***

## Как минимально пользоваться этим

Твой “минимальный набор” из этого файла:

- **Промпт 1** — когда хочешь просто понять, что происходит (анализ без правок).
- **Промпт 2** — когда хочешь маленький аккуратный патч.
- **Промпт 3** — когда хочешь проверить результат перед коммитом.
- **Промпт 4** — когда речь про лиды.
- **Промпт 5** — когда речь про бота.
- **Промпт 8** — когда ты не знаешь, как вообще написать промпт — просто пишешь по‑русски, он сам превратит в правильный английский.

Если хочешь, следующим шагом я помогу тебе **укоротить нынешний CLAUDE.md** (чтобы не тратить на него лишние токены) и добавлю в него компактный блок про экономию токенов, чтобы Claude “по умолчанию” вёл себя более экономно.
