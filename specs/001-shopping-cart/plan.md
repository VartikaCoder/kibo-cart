# Implementation Plan: Shopping Cart Web Application

**Branch**: `001-shopping-cart` | **Date**: 2026-10-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-shopping-cart/spec.md`

## Summary

A Next.js 16 App Router storefront over fakestoreapi.com: a URL-driven, server-filtered, paginated product
listing, and a client cart persisted to localStorage and synced across tabs. Architecture: a **pure cart
domain** (integer-cents money, quantity limits supplied by a policy cap plus a clearly simulated inventory
adapter), a thin **Zustand** adapter with validated, versioned persistence, and **Zod** at every trust boundary
(API, storage, URL). If the API fails, the listing falls back to a bundled snapshot validated the same way. The
cart lives in a native `<dialog>` drawer, with a single polite live region for announcements. Testing is layered:
Jest domain/unit tests, RTL integration with MSW, and Playwright + axe E2E against a deterministic fixture.
See [research.md](./research.md) for every decision.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`) on Node.js ≥ 20.9 (dev: 24.20)

**Primary Dependencies**: Next.js 16.4.3 (App Router, `cacheComponents`, `partialPrefetching`), React 19.3,
Tailwind CSS 4, Zustand 5, Zod 4

**Storage**: Browser `localStorage` (cart only, key `kibo-cart`, versioned envelope). No server storage. The
catalogue is cached with Next `'use cache'` (in-memory handler).

**Testing**: Jest 30 (`next/jest`, node + jsdom projects), React Testing Library + `@testing-library/jest-dom`,
`jest-environment-jsdom`, MSW 2 (`msw/node`), Playwright + `@axe-core/playwright`. `user-event` was declined;
keyboard fidelity is covered in Playwright.

**Target Platform**: Evergreen browsers (Chromium, Firefox, WebKit, last 2 versions), mobile and desktop. Node.js
server runtime (Vercel).

**Project Type**: Web application (single Next.js project, no own backend)

**Performance Goals**: Lighthouse mobile Performance and Accessibility ≥ 90 (SC-004). CLS ≈ 0 on load. One cart
line change re-renders only its own card control (SC-005). Cross-tab update < 1 s (SC-007).

**Constraints**: Integer-cents money only. No `dangerouslySetInnerHTML`. Images only from `fakestoreapi.com`.
Static CSP header (no nonces, to keep the static shell). No new deps beyond those listed. Hydration-safe rendering
(fixed `en-US` locale, deterministic simulated inventory).

**Scale/Scope**: About 20 live products, a 500-item generated fixture for the large-catalogue case, 1 route (`/`) +
drawer, 4 user stories, 18 FRs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate | Pre-research | Post-design |
|---|---|---|---|
| I. Correctness over features | Every story has its failure modes designed; money in cents | ✅ Edge cases are mapped to designs in research R3, R6–R9 | ✅ Domain outcomes enumerate limit/clamp/reject/not-found; snapshot, unavailable, and price-change paths are defined |
| II. Pure domain core | Rules in framework-free functions; store/UI are adapters | ✅ `features/cart/domain` is pure; limits are passed in | ✅ data-model §6: every op is `(cart, …) → {cart, outcome}`, with no UI strings in domain |
| III. Untrusted boundaries | API, storage, URL validated; nothing as HTML; dev-visible failures | ✅ Three Zod schemas (R4) | ✅ Contracts define the per-boundary failure → fallback and dev warning |
| IV. Accessible by default | Keyboard, semantics, focus, announcements, AA, CI checks | ✅ R9 | ✅ contracts/ui-components.md specifies names, focus targets, and copy; axe runs in E2E/CI |
| V. Behavioural, layered testing | Unit → integration (mocked network) → E2E; never weakened | ✅ R11 | ✅ An MSW scenario list and quickstart scenarios map to every acceptance scenario |
| VI. Measured performance | Claims backed by profiler, Lighthouse, or bundle analysis | ✅ R12 | ✅ Evidence goes in `docs/performance.md`; no speculative memoisation |
| VII. Owned AI output | Corrections logged | ✅ `developer-log.md` is created in setup | ✅ |
| Constraint: deps | Each new dep is justified | ✅ The stack deps are pre-approved in CLAUDE.md. The 2 extra test deps were approved by the engineer, 1 was declined. The bundle analyzer is not needed (`next analyze`) | ✅ |
| Constraint: CI | lint, typecheck, test on push | ✅ R13 | ✅ |

**Result**: PASS. No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-shopping-cart/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R13 + assumptions
├── data-model.md        # Phase 1: entities, invariants, domain operations
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── catalogue-api.md       # consumed: fakestoreapi + fallback matrix
│   ├── url-search-params.md   # exposed: listing URL state
│   ├── persisted-cart.md      # localStorage envelope, validation, versioning, cross-tab
│   └── ui-components.md       # component surface, accessible names, announcement copy
└── tasks.md             # Phase 2 (/speckit-tasks), not created here
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx               # header (CartButton), CartHydrator, CartAnnouncer, CartDrawer (CatalogueSync: scoped out)
│   ├── page.tsx                 # awaits searchParams → parse → applyCatalogueQuery
│   ├── loading.tsx              # Suspense fallback: heading + filter-row placeholder + card-sized skeleton grid
│   ├── error.tsx                # error state + retry()
│   └── globals.css              # @theme design tokens (colour, focus ring, spacing, radii)
├── features/
│   ├── catalog/
│   │   ├── api/                 # fetch-catalogue.ts, get-catalogue.ts ('use cache'), refresh-catalogue.ts (Server Action),
│   │   │                        # to-product.ts, snapshot.json, fixtures/ (fixture + large generator)
│   │   ├── schemas/             # api-product.ts, catalogue-query.ts
│   │   ├── query/               # apply-catalogue-query.ts, serialize-catalogue-query.ts (pure)
│   │   ├── components/          # ProductListing, ProductGrid, ProductCard, ProductGridSkeleton, CatalogueFilters,
│   │   │                        # ResultSummary, Pagination, EmptyResults, SnapshotNotice, CatalogueError
│   │   ├── index.ts             # public surface (may include server-only code)
│   │   └── client.ts            # client-safe subset, re-exported by index.ts
│   └── cart/
│       ├── domain/              # cart.ts (ops), selectors.ts, reconcile.ts, migrate.ts, types.ts (+ *.test.ts)
│       ├── store/               # cart-store.ts, persisted-cart-schema.ts, safe-storage.ts
│       ├── components/          # AddToCartControl, CartButton, CartDrawer, CartLineItem, CartAnnouncer,
│       │                        # CartHydrator, announce-copy.ts, cart-commands.ts (CatalogueSync: scoped out)
│       └── index.ts
├── components/ui/               # Button, IconButton, Badge, Rating, QuantityStepper, Drawer, Skeleton, VisuallyHidden
├── lib/                         # money.ts, stock.ts, inventory.ts (SIMULATED), env.ts (server-only CATALOGUE_SOURCE)
└── test/                        # msw server + handlers, render helpers, jest setup

e2e/                             # catalogue.spec.ts, cart.spec.ts, persistence.spec.ts, a11y.spec.ts
docs/                            # adr-001-state-management.md, performance.md, security.md
.github/workflows/ci.yml
jest.config.mjs  playwright.config.ts  developer-log.md  README.md
```

**Structure Decision**: A single Next.js project following the feature-sliced layout in CLAUDE.md. Dependencies
flow `app → features → components/ui, lib`, and features talk to each other only through `index.ts`. The one
addition to the CLAUDE.md tree is `features/catalog/query/` for the pure listing logic (filter/sort/paginate/URL
serialisation). It is kept separate from `schemas/` so it can be unit-tested without Zod concerns. `src/test/`
holds shared test infrastructure. Domain tests sit beside their code.

## Requirement → design traceability

| FR | Design element |
|---|---|
| FR-001, FR-002 | `ProductCard`, `ProductGridSkeleton`, `EmptyResults`, `error.tsx`, `SnapshotNotice` |
| FR-003–FR-005 | `catalogue-query` schema + `applyCatalogueQuery` + `Pagination` (contracts/url-search-params.md) |
| FR-006–FR-009 | `cart/domain` ops + narrow-selector components (data-model §6) |
| FR-010 | `lib/money.ts` (branded `Cents`) |
| FR-011, FR-012 | persist + `safe-storage` + `CartHydrator` (contracts/persisted-cart.md) |
| FR-013, FR-014 | `api-product` schema, per-item `safeParse`; text-only rendering; CSP |
| FR-015, FR-016 | Tailwind responsive grid; native `<dialog>`; focus rules (contracts/ui-components.md) |
| FR-017 | `CartAnnouncer` + announcement copy table |
| FR-018 | **Scoped out.** `reconcileWithCatalogue` and the store's `reconcile()` exist and are tested; `CatalogueSync` and the line states are not built. See [README](../../README.md#live-price-reconciliation-and-no-longer-available-lines-fr-018). |

## Open assumptions

Listed in [research.md → Assumptions](./research.md#assumptions-please-confirm-or-correct): the cart view is the
drawer; unavailable lines are excluded from the subtotal; USD/en-US; title-only search; default sort "Featured"; page size 12.

## Complexity Tracking

No constitution violations, so nothing to justify.
