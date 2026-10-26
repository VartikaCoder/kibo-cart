# Phase 0 Research: Shopping Cart Web Application

**Feature**: `001-shopping-cart` | **Date**: 2026-10-26 | **Plan**: [plan.md](./plan.md)

Each entry: **Decision**, **Rationale**, **Alternatives considered**. Entries marked *(user decision)* were
presented as trade-offs and chosen by the engineer on 2026-10-26; all others follow from the spec,
constitution, CLAUDE.md, or the Next.js 16.4 docs shipped in `node_modules/next/dist/docs/`.

---

## R1. Next.js 16 rendering model (Cache Components + Partial Prefetching)

**Decision**: Keep the scaffold's `cacheComponents: true` + `partialPrefetching: true`. The catalogue fetch is a
`'use cache'` function tagged `catalogue`. The listing page reads `searchParams` inside a `<Suspense>` boundary
whose fallback is a fixed-size skeleton grid; header, layout, and filter chrome form the prerendered static shell.

**Rationale**: With Cache Components, data access is dynamic by default and anything reading `searchParams`
must sit under `<Suspense>`. Passing parsed query values *as arguments* into cached functions keeps results
cacheable per query (`use-cache.md` → "Cache keys"). Static shell + streamed results gives a fast LCP for SC-004.

**Alternatives considered**: Disabling Cache Components and using the legacy `fetch` cache — rejected, it fights
the scaffold and the version's defaults. Full static generation — impossible, since the view depends on `searchParams`.

**Version-specific notes discovered** (differ from pre-16 knowledge):
- `error.tsx` receives `{ error: unknown, retry: () => void }`, not `reset`.
- `updateTag(tag)` (Server Actions only) expires a tag immediately; used by the "Retry" action.
- `cacheLife` can be called conditionally, but only once per invocation (`cacheLife.md` → "Conditional cache lifetimes").
- `next analyze` is built in, so `npm run analyze` needs **no** `@next/bundle-analyzer` dependency.
- Cache Components forbids a `runtime` segment export; the app runs on Node.js.
- Jest cannot render `async` Server Components (`testing/jest.md`); those are covered by Playwright.

## R2. Where filtering, search, sort, and pagination run *(user decision)*

**Decision**: Server-side. `page.tsx` awaits `searchParams`, parses it with `parseCatalogueQuery` (Zod, never
throws), and runs pure `applyCatalogueQuery(products, query)` over the cached catalogue. Only the current page
of products crosses to the client. The search box is a small client leaf that debounces (300 ms) and calls
`router.replace` with a `URLSearchParams`-built URL. Category, sort, and pagination use plain `<Link>`/`<form method="get">`
so they also work before hydration.

**Rationale**: Payload stays O(page size) even for the large-dataset test. Pages are crawlable, and back/forward
works natively (FR-004, US1-AS6). Query logic stays pure and unit-testable.

**Alternatives considered**: Client-side filtering — instant search, but the whole catalogue ships to the browser
and duplicates the URL-state machinery.

## R3. API unavailability and invalid data *(user decision)*

**Decision**: Snapshot fallback. `fetchCatalogue()`:
1. `fetch(PRODUCTS_URL, { signal: AbortSignal.timeout(5000) })`.
2. Non-2xx, network error, timeout, non-JSON, or non-array → *source failure*.
3. Array → per-item `ApiProductSchema.safeParse`. Invalid items are dropped (dev: `console.warn` with index + issues). If **zero** valid items remain → *source failure*.
4. On source failure → load the bundled `src/features/catalog/api/snapshot.json`, validated with the **same**
   schema. Return `{ source: 'snapshot', products }`.
5. If the snapshot also yields zero valid items → throw `CatalogueUnavailableError` → `error.tsx` (error state + Retry).

`getCatalogue()` (the cached wrapper) calls `cacheLife('hours')` for `source: 'live'` and an inline short profile
(`{ stale: 30, revalidate: 60, expire: 300 }`) for `source: 'snapshot'`, so the app recovers quickly when the API
comes back. The UI shows a non-blocking notice, "Showing a saved copy of the catalogue. Prices may be out of
date.", with a **Retry** button bound to a Server Action that calls `updateTag('catalogue')` and then `router.refresh()`.

**Rationale**: fakestoreapi is unreliable and has been seen returning 403 to cloud/serverless egress IPs, which
would otherwise break the live deployment. Using the same validation path means the snapshot is trusted no more
than the API.

**Alternatives considered**: Error + retry only — more honest about freshness, but the deployed demo fails
whenever the API blocks the host.

**Consequence for FR-018**: Price reconciliation and "product no longer exists" flagging run **only** when
`source === 'live'`. A snapshot is not authoritative, so it must not rewrite cart prices or flag lines as missing.

## R4. Validation (Zod) at the three trust boundaries

**Decision**: Zod 4. One schema module per boundary:
- `features/catalog/schemas/api-product.ts`: mirrors the API exactly (no `stock`). Adds refinements: `id` positive
  int; `price` finite and ≥ 0; `image` an `https:` URL whose host is `fakestoreapi.com` (required because `next/image`
  throws on disallowed hosts); `rating.rate` 0–5; `rating.count` int ≥ 0; strings trimmed and non-empty for title/category.
- `features/catalog/schemas/catalogue-query.ts`: URL params. Uses `.catch()` per field so bad input falls back to
  defaults and never throws.
- `features/cart/store/persisted-cart-schema.ts`: localStorage payload (see [contracts/persisted-cart.md](./contracts/persisted-cart.md)).

**Rationale**: Constitution III. Per-item `safeParse` (rather than parsing the array) gives the "drop invalid items" behaviour of FR-013.

**Alternatives considered**: Valibot (smaller) — it isn't in the approved stack.

## R5. Money

**Decision**: `lib/money.ts` exports `toCents(price: number): Cents` (`Math.round(price * 100)`, and rejects
non-finite or negative values) and `formatMoney(cents: Cents): string` using one memoised
`Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`. `Cents` is a branded `number`.
The locale is **fixed** so server and client output match (no hydration mismatch). Conversion happens once,
in the API→domain mapper.

**Rationale**: FR-010, SC-002. Branding stops a float price being passed where cents are expected.

**Alternatives considered**: `navigator.language` locale — causes SSR/CSR markup mismatch. Decimal library — unnecessary for integer cents.

## R6. Cart state: Zustand + persist + hydration + cross-tab

**Decision**:
- Zustand 5 `create` with the `persist` middleware, `name: 'kibo-cart'`, `version: 1`, `skipHydration: true`, and
  `partialize` limited to `{ lines }`. A custom `storage` wrapper runs `PersistedCartSchema.safeParse` on read; on
  failure it removes the key, logs in dev, and returns `null` (empty cart). `migrate(persisted, fromVersion)` is
  routed through a pure, unit-tested `migrateCart` (only v1 exists today; unknown or future versions → empty cart).
- A client `CartHydrator` (mounted once in the root layout) calls `useCartStore.persist.rehydrate()` in an effect
  and sets `hydrated: true`. Before hydration, count/total UI renders a **neutral placeholder** (badge without a
  number, totals as a skeleton), never `0`, so there is no flash of wrong data (US3-AS4).
- Cross-tab: `CartHydrator` listens for `window` `storage` events where `key === 'kibo-cart'` and calls
  `rehydrate()`. `newValue === null` (cleared) → empty cart. Last-write-wins (spec clarification).
  `storage` fires only in *other* tabs, and rehydration does not write back, so there is no echo loop.
  An integration test asserts exactly one write per user action.
- All actions use the functional `set(state => …)` form and delegate to pure domain functions, so rapid
  repeated clicks each apply against the latest state (no stale closure, no lost updates).

**Rationale**: ADR-001 (to be written) records the Zustand choice. `skipHydration` + manual rehydrate is the
documented way to keep SSR markup deterministic.

**Alternatives considered**: `useSyncExternalStore` over localStorage directly — more hand-written code for the
same guarantees. `BroadcastChannel` — no benefit over `storage` for localStorage-backed state, and it duplicates the write path.

## R7. Product data for the cart (price reconciliation, missing products)

**Decision**: The root layout (Server Component) awaits `getCatalogue()` and renders
`<CatalogueSync source={source} prices={[[id, priceCents], …]} />`, a client leaf that calls
`reconcileWithCatalogue` once both the cart is hydrated and the price index is present. The index is a compact
array of id→cents pairs, not full products, so product data does not enter the Zustand store (CLAUDE.md state rules).
Results:
- A price changed → the line's `unitPriceCents` is updated, and an ephemeral (non-persisted) `priceNotices` entry is
  shown on the line until dismissed. One announcement: "Prices updated for N items in your cart."
- A product is missing from the live catalogue → the line is derived as `unavailable` (not stored), shown with
  "No longer available", and only Remove is offered.

**Rationale**: FR-018 and the "product no longer exists" edge case, without the store owning server data.

**Alternatives considered**: Client-side fetch of the catalogue — duplicates the network path and the trust boundary.

## R8. Quantity limits and simulated inventory

**Decision**:
- `lib/stock.ts`: `MAX_QTY_PER_LINE = 10` (store policy) and
  `getLineLimit(productId, inventory): { max: number; reason: 'policy' | 'availability' }`, with
  `max = min(MAX_QTY_PER_LINE, inventory.getAvailable(productId))`.
- `lib/inventory.ts`: `interface InventoryProvider { getAvailable(productId: number): number }` and
  `simulatedInventory`, a **deterministic** function of `productId` (stable across server and client, so no
  hydration mismatch) returning 3–20. The file header says it is simulated. A real API would replace only this adapter.
- Cart domain functions take `maxQuantity: number` as a parameter.
- UI copy: `reason: 'policy'` → "Limit 10 per order". `reason: 'availability'` → "Only N available (demo inventory)".
  The README documents that availability is simulated.

**Rationale**: Spec clarifications and CLAUDE.md "Stock / inventory". A 3–20 range makes sure some items cap below 10, so both paths are exercised.

**Alternatives considered**: Random availability — non-deterministic, causes hydration mismatch and flaky tests.

## R9. Accessibility patterns

**Decision**:
- **Drawer**: native `<dialog>` opened with `showModal()`. This gives browser-native focus containment (inert
  background), `Esc` to close, and a `::backdrop`. Focus is explicitly restored to the trigger on close, and the
  heading is `aria-labelledby`. No dependency needed.
- **Live region**: a single `<div role="status" aria-live="polite">` rendered once by `CartAnnouncer` in the root
  layout. Messages come from an ephemeral `announcement: { id, message }` slice; the `id` makes repeated identical
  messages re-announce.
- **Max-quantity**: the increment button uses `aria-disabled="true"` (stays focusable, so focus isn't lost). Clicks
  are ignored, the limit reason is visible next to the stepper and linked with `aria-describedby`, and it is announced.
- **Decrement at 1**: the button's accessible name changes to "Remove {title} from cart" and it shows a trash icon.
  The action is explicitly a removal (US2-AS3).
- **Direct quantity input**: `<input type="number" inputmode="numeric" min=1 max={max}>` commits on blur/Enter.
  Non-integers or empty values revert, and out-of-range values clamp, with an announcement.
- **Focus after removing a line**: next line's Remove button → previous line's → the drawer's empty-state message
  (`tabIndex={-1}`).
- **Search**: `<search>` landmark + labelled `<input type="search">`. The result count is announced politely and debounced.

**Rationale**: FR-016, FR-017, Constitution IV. Native elements before ARIA.

**Alternatives considered**: A Radix/Headless UI dialog — needs a new dependency, and native `<dialog>` is now broadly supported.

## R10. Content Security Policy *(user decision)*

**Decision**: Static CSP set in `next.config.ts` `headers()` for all routes:
`default-src 'self'; script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` in dev only);
`style-src 'self' 'unsafe-inline'`; `img-src 'self' data: https://fakestoreapi.com`; `font-src 'self'`;
`connect-src 'self'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`; `object-src 'none'`.
Also `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`.
`next/font` self-hosts Geist, so no external font origin is needed.

**Rationale**: Nonce CSP forces dynamic rendering of every page (`content-security-policy.md`), which removes the
static shell and hurts SC-004. The XSS surface is already small: there is no `dangerouslySetInnerHTML`, all text
renders as text, and there is no user-generated HTML. The `'unsafe-inline'` trade-off is written up in the security notes.

**Alternatives considered**: Nonce via `proxy.ts` — stricter `script-src`, but every route becomes dynamic.

## R11. Testing stack and approach

**Decision**:
- **Jest 30** via `next/jest`, with two projects: `node` (domain, lib, schemas, `fetchCatalogue` with MSW) and
  `jsdom` (client components). Approved extra dev deps: `jest-environment-jsdom`, `@testing-library/jest-dom`.
- **`@testing-library/user-event` was declined** *(user decision)*. Component tests use RTL `fireEvent`. Behaviours
  that need faithful keyboard/pointer semantics (Tab order, focus trapping, Esc, rapid real clicks) are covered in **Playwright**.
  Rapid-click correctness is also proven at the domain/store level (N sequential actions → N applied).
- **MSW 2** (`msw/node`) intercepts `https://fakestoreapi.com/products` in node-env tests: valid, partially-invalid,
  all-invalid, 500, timeout, and non-JSON. Client component tests need no network, because they receive props.
- **Playwright** runs against `next build && next start` with `CATALOGUE_SOURCE=fixture` (server-only env read in
  `catalog/api`), so E2E is deterministic. `CATALOGUE_SOURCE=fixture-large` serves a generated catalogue of 500
  items for the large-catalogue edge case. `@axe-core/playwright` runs on the listing, the open drawer, empty, and
  error states (SC-003).
- **Coverage**: `coverageThreshold` global 80% lines/branches, and `./src/features/cart/domain/` 90% (SC-006).
- **No** snapshot tests. RTL queries by role/label.

**Rationale**: Constitution V. Fixture mode stops a flaky third-party API from making CI red.

**Alternatives considered**: Vitest — not the approved stack. `jest-fixed-jsdom` to run MSW inside jsdom — not
needed, because network tests run in the node environment.

## R12. Performance verification (SC-004, SC-005)

**Decision**: SC-005 — `ProductCard` is a Server Component. The only client leaf per card is `AddToCartControl`,
subscribing with `useCartStore(s => selectLineQuantity(s, productId))` (a primitive), so changing one line
re-renders only that card's control. Verified with the React Profiler (screenshot in `docs/performance.md`) and an
RTL render-count test using a `<Profiler>` `onRender` counter. SC-004 — Lighthouse mobile on the deployed URL,
with results recorded in `docs/performance.md`. `next/image` uses explicit `sizes` and `priority` on the first row only.
Skeletons match final card dimensions (CLS ≈ 0, US1-AS2).

**Alternatives considered**: `React.memo` everywhere — unmeasured optimisation (Constitution VI).

## R13. CI and delivery

**Decision**: GitHub Actions `ci.yml` on push/PR: `npm ci` → `lint` → `typecheck` → `test:cov` → `build` →
`e2e` (Playwright Chromium, fixture mode). Deploy target: Vercel (README notes the snapshot fallback for
fakestoreapi blocking).

---

## Resolved unknowns

All Technical Context fields are resolved; no `NEEDS CLARIFICATION` remains.

## Assumptions (please confirm or correct)

1. **"Cart view" = the drawer.** There is no separate `/cart` route. SC-003 axe checks run on the open drawer.
2. **Unavailable lines are excluded from the subtotal** and item count, and are shown separately with Remove only.
3. **Currency is USD, locale `en-US`**, fixed (fakestoreapi prices are USD).
4. **Search matches title only** (FR-003), case-insensitive, with substring matching via `String.prototype.includes`
   (no regex). The query is trimmed and capped at 100 characters.
5. **Default sort is "Featured"** (API order). An unknown category in the URL is ignored and shows all products.
   A `page` beyond the last page clamps to the last page.
6. **Page size is 12** and is not user-configurable.
