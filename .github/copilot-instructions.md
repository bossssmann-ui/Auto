# Copilot Instructions

## Project Overview

Спецтехмаш — a high-converting, single-page marketing website for a company that imports vehicles, motorcycles, and heavy machinery from Japan, Korea, and China to Russia. The site is fully in **Russian** and targets a B2B audience.

## Tech Stack

- **Frontend:** React 19, TypeScript (strict mode), Vite 8
- **Styling:** Tailwind CSS v4 (configured via `@tailwindcss/vite` plugin)
- **Backend:** Lightweight Node.js HTTP server (no framework) in `server/`
- **Integrations:** Telegram Bot API, amoCRM API, YouTube Data API

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Type-check with `tsc -b` and build for production with Vite
- `npm run lint` — Run ESLint
- `npm run preview` — Preview production build
- Server type-check: `npx tsc --noEmit --esModuleInterop --module nodenext --moduleResolution nodenext --target ES2022 --strict --skipLibCheck server/lead.ts server/index.ts`

## Project Structure

```
src/
├── App.tsx           # Main app component, assembles all sections
├── api.ts            # Frontend API client for lead submission
├── index.css         # Tailwind imports and custom theme variables
├── main.tsx          # React entry point
├── assets/           # Static images and files
└── components/       # 15 React components (one per section/feature)
server/
├── index.ts          # HTTP server with CORS and POST /api/lead endpoint
└── lead.ts           # Lead processing: validation, Telegram & amoCRM integration
```

## Coding Conventions

- Use **TypeScript** with strict mode for all code.
- Use **functional React components** with hooks — no class components.
- Use **ES2023+** syntax (`async/await`, optional chaining, nullish coalescing).
- Use **PascalCase** for component file names and component names (e.g., `HeavyMachinery.tsx`).
- Use **camelCase** for variables, functions, and non-component files.
- Keep one component per file. Each major page section is its own component.

## Styling

- Use **Tailwind CSS v4** utility classes for all styling — avoid inline styles and custom CSS files.
- Custom theme tokens are defined in `src/index.css` under `@theme` (colors: `primary`, `accent`, `gold`, `surface`; fonts: `heading`, `body`).
- Reference theme colors via Tailwind classes (e.g., `bg-primary`, `text-accent`).

## Language & Localization

- All user-facing text is in **Russian**. Maintain Russian for all UI strings, labels, headings, and descriptions.
- Code comments and variable names should be in **English**.

## Server / Backend

- The server in `server/` is a plain Node.js HTTP server — do not add Express or other frameworks.
- Lead submission validates `name` and `phone` fields; sends notifications to Telegram and creates contacts/leads in amoCRM in parallel.
- Environment variables are documented in `.env.example`. Never commit `.env` files.

## Prohibited Patterns

- Do not commit secrets, API keys, or credentials.
- Do not add test frameworks unless explicitly requested — the project currently has no test infrastructure.
- Do not use class components or jQuery.
- Do not add CSS-in-JS libraries (styled-components, emotion, etc.) — use Tailwind.
