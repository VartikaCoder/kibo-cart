# CLAUDE.md

Context for AI coding agents working in this repository. Read this fully before making changes.
The feature spec lives in `specs/001-shopping-cart/spec.md`; project principles in `.specify/memory/constitution.md`.
When this file and the spec disagree, stop and ask.

## Project

A production-grade shopping cart web app built as a Senior UI Engineer assignment.
Product data comes from `https://fakestoreapi.com/products`. There is no backend of our own.
Reviewers evaluate architecture, edge-case handling, accessibility, testing depth, and written reasoning — not feature count.

## Stack

- Next.js (App Router) + React + TypeScript (`strict: true`)
- Tailwind CSS — design tokens defined once in `src/app/globals.css` (`@theme`)
- Zustand (client cart state) — see `docs/adr-001-state-management.md`
- Zod (runtime validation at every trust boundary)
- Jest + React Testing Library + MSW (unit / integration)
- Playwright + @axe-core/playwright (end-to-end + automated a11y)

Do not add a dependency without asking first and stating why the platform or existing deps can't do it.

## Commands

```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # jest (unit + integration)
npm run test:cov     # jest with coverage thresholds
npm run e2e          # playwright
```

Before calling any task done: `lint`, `typecheck`, and `test` must pass.

## Folder structure and dependency rules

```
src/
  app/                  # routes, layouts, loading/error files. Thin: compose features, no business logic
  features/
    catalog/
      api/              # fetchCatalogue() (fetch + validation + snapshot fallback), getCatalogue() ('use cache')
      schemas/          # zod schemas + inferred types
      query/            # PURE listing logic: filter/search/sort/paginate, URL (de)serialisation
      components/
      index.ts          # the feature's public surface (may include server-only code)
      client.ts         # the subset importable from Client Components; index.ts re-exports it.
                        # Client Components import from client.ts, never from deep paths.
    cart/
      domain/           # PURE functions + types. No React, no Zustand, no browser APIs
      store/            # zustand store, persistence, cross-tab sync
      components/
      index.ts
  components/ui/        # design-system primitives (Button, Badge, QuantityStepper, Drawer...)
  lib/                  # cross-cutting utils: money, format, env, stock
docs/  review/  e2e/  specs/
```

Dependency direction (enforce it, don't work around it):

- `app` → `features` → `components/ui`, `lib`
- A feature imports another feature only through its `index.ts`, never deep paths.
- `features/cart/domain` imports nothing from React, Zustand, Next, or `window`. If you need one of these, the code belongs in `store/` or `components/`.
- `components/ui` knows nothing about products or carts.

## Conventions

- TypeScript: no `any`, no non-null `!` assertions without a comment explaining why it's safe. Prefer `unknown` + narrowing.
- Named exports only (except where Next.js requires default exports: `page`, `layout`, etc.).
- Server Components by default. Add `'use client'` only to the smallest leaf that needs interactivity.
- Filter/search/sort/page state lives in the URL search params, not in component or global state.
- Derive values during render; do not mirror derived state into `useState` via `useEffect`.
- Small, focused components. If a component needs a comment to explain what it does, split it.
- File names: `kebab-case.ts(x)`; components `PascalCase` exports.

## Money

- **All money is integer cents (`number`) inside the app.** Never do arithmetic on float prices.
- Convert exactly once, at the API boundary: `toCents(price) = Math.round(price * 100)` in `lib/money.ts`.
- Format only in the UI layer with `Intl.NumberFormat` (`formatMoney(cents)`). Never `toFixed` for display.
- Totals are computed from line items (`unitPriceCents * quantity`), never stored.

## Stock / inventory

- fakestoreapi has **no inventory data**. Never add a `stock` field to the product schema. The schema mirrors the API.
- Two distinct concepts, never conflated in code, UI copy, tests, or docs:
  - `MAX_QTY_PER_LINE = 10`: a real store policy.
  - Simulated availability via `InventoryProvider` in `src/lib/inventory.ts`: clearly named and commented as simulated.
- Domain functions take the max quantity as an input; they don't know where it comes from.
- Never write copy like "only N left in stock" unless it's backed by the simulated provider and documented as such.

## State rules

- Cart state lives in the Zustand store; product (server) data does not.
- Store actions delegate to pure functions in `cart/domain`. No business rules inside the store.
- Components subscribe with **narrow selectors** (`useCartStore(s => s.totalQuantity)`), never the whole store.
- Persisted cart is untrusted input: validate with Zod on rehydrate; on failure, discard and start empty (and log in dev).
- Persisted shape carries a `version`; changing the shape requires a migration.
- Reading persisted state must be hydration-safe (no server/client markup mismatch).
- Cross-tab sync: listen for the `storage` event and rehydrate. Conflict policy is last-write-wins.

## Security rules

- **Never use `dangerouslySetInnerHTML`.** Render API text as text.
- Validate all API responses with Zod before use. Invalid items are dropped, not trusted.
- Images only via `next/image` with `remotePatterns` restricted to `fakestoreapi.com`.
- No secrets in client code; nothing in this app needs one.
- Never build URLs or HTML by concatenating user input. Use `URLSearchParams`.
- Security headers (CSP etc.) live in `next.config` — don't loosen them to make something work without asking.

## Accessibility rules

- Semantic HTML first (`header`, `main`, `nav`, `button`, lists). ARIA only when no native element fits.
- Every interactive element is keyboard-reachable with a visible focus style.
- Icon-only buttons have an accessible name (e.g. "Increase quantity of {title}").
- Cart changes are announced via a single polite live region.
- Focus is managed deliberately: drawer traps and restores focus; removing a line moves focus to a sensible target.
- Text contrast meets WCAG AA. Don't encode meaning in colour alone.

## Testing rules

- Test **behaviour, not implementation**. Assert on what the user sees or what a function returns — not on internal state, hook calls, or component structure.
- RTL query priority: `getByRole` → `getByLabelText` → `getByText`. `getByTestId` only as a last resort, with a comment.
- No snapshot tests.
- Mock the network with MSW, not by mocking `fetch` or our own modules.
- Every edge case listed in the spec has a test, or a written reason in the README for why it doesn't.
- Domain tests sit beside the code (`*.test.ts`); E2E tests in `/e2e`.
- **Never weaken, skip, or rewrite a test just to make it pass.** If a test looks wrong, say so and explain.
- Every bug fix comes with a test that fails before the fix.

## How to work with me (AI agent rules)

- Make small, reviewable changes. One concern per change.
- Reference spec requirement IDs (e.g. `FR-007`) in your explanation of what you implemented.
- When there's a real trade-off, present the options briefly and wait — don't silently pick one.
- If the spec is ambiguous, ask instead of guessing.
- Don't refactor code outside the task's scope.
- After generating code, list any assumptions you made.

## Definition of done

- Meets the acceptance scenarios for the relevant user story
- Lint, typecheck, tests pass; coverage thresholds hold
- Keyboard and screen-reader behaviour checked for any new UI
- No new `any`, no `dangerouslySetInnerHTML`, no float money math
- Relevant doc updated (README, ADR, performance or security notes)
