# Repository Guidelines

## Project Structure & Module Organization
- `src/app` holds Next.js routes; keep pages slim and push logic into shared modules.
- UI lives in `src/components`, state in `src/stores`, hooks in `src/hooks`, and utilities in `src/lib`.
- Tests sit in `src/lib/tests`; mirror library file names when adding specs.
- WASM artifacts land in `src/wasm-module` via `scripts/copy-wasm.js` from `wasm/pkg`; never hand-edit generated output.
- Worker code resides in `src/workers` with shared message types in `worker.d.ts`.

## Build, Test, and Development Commands
- `npm run dev` copies the latest WASM bundle and starts the Next.js dev server.
- `npm run build` produces the production bundle; run it before release branches.
- `npm start` serves the compiled build locally.
- `npm run lint` applies the Next.js ESLint stack (core web-vitals, TypeScript).
- `npm run copy-wasm` refreshes generated modules after tweaking Rust sources in `wasm/`.
- `npx vitest` (watch) or `npx vitest run` (CI) executes the unit suite.

## Coding Style & Naming Conventions
- TypeScript everywhere; prefer explicit exports and the `@/` alias over deep relative paths.
- Use two-space indentation, PascalCase for React components, camelCase for helpers, and kebab-case for file names.
- Compose styling with Tailwind classes and rely on `clsx`/`cva` helpers for conditional variants.
- Keep side effects in hooks or stores; components should stay declarative and focused on rendering.

## Testing Guidelines
- Follow the `*.test.ts` suffix and group assertions by feature within `describe` blocks.
- Expand coverage when adjusting `.gitignore` parsing, token math, or worker bridges; include Windows/Posix path cases.
- Run `npx vitest run --coverage` before merging substantive logic changes; document gaps if coverage drops.

## Commit & Pull Request Guidelines
- Use conventional commit prefixes (`feat:`, `fix:`, `refactor:`) as reflected in the existing history.
- Ensure each commit and PR passes `npm run lint` and `npx vitest run`; include the commands in the PR summary.
- PRs should link issues, attach UI screenshots or GIFs when visuals change, and note whether WASM assets were regenerated.
- Call out worker or store contract updates so reviewers can verify the corresponding TypeScript and generated bundles.

## WASM & Worker Notes
- After editing the Rust package, rebuild it in the Rust workspace and run `npm run copy-wasm` before committing.
- Keep message payload schemas aligned across `src/workers`, `src/stores`, and `worker.d.ts`; update tests when formats shift.
