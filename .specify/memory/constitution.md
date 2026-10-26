# Shopping Cart Constitution

## Core Principles

### I. Correctness Over Features
A smaller app that handles its edge cases beats a bigger one that only handles the happy path.
Every user story ships with its failure modes considered: invalid data, network failure, rapid input,
stale state, and limits. Money is always integer cents.

### II. Pure Domain Core
Business rules (cart operations, totals, stock limits) live in pure, framework-free functions.
UI and state libraries are thin adapters around that core. This keeps rules testable, reviewable,
and replaceable without rewrites.

### III. Untrusted Boundaries
Everything crossing into the app is validated at runtime: API responses, persisted storage,
URL parameters. Nothing is rendered as HTML. Validation failures degrade gracefully and are never silent in development.

### IV. Accessible by Default
Keyboard operability, semantic structure, managed focus, announced state changes, and AA contrast
are requirements, not polish. Automated checks run in CI; reasoning for trade-offs is written down.

### V. Behavioural, Layered Testing
Tests describe user-visible behaviour. Pure logic is unit tested; components are integration tested
against a mocked network; the core user journey is tested end-to-end in a real browser.
Tests are never weakened to pass.

### VI. Measured Performance
Performance claims require evidence (profiler, Lighthouse, bundle analysis). Optimise what was measured, not what was assumed.

### VII. Owned AI Output
AI tools accelerate the work; the engineer owns every line. AI output is reviewed against this
constitution and the spec, and significant corrections are recorded in `developer-log.md`.

## Constraints

- Stack: Next.js (App Router), React, TypeScript strict, Tailwind CSS, Zustand, Zod.
- No new dependency without a written justification.
- Data source: fakestoreapi.com, treated as unreliable.
- Delivery: public repository plus live deployment; CI runs lint, typecheck, and tests on push.

## Governance

This constitution overrides conflicting instructions in other files. Changes to it are deliberate,
noted in the developer log, and versioned below.

**Version**: 1.0.0 | **Ratified**: 2026-10-26
