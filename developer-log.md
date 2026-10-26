# Developer log

Working notes, newest first. Each entry records what changed, the decisions behind it, and anything that surprised me.
These are notes; the spec, plan, and ADRs are the authoritative documents.

---

## 2026-10-26 — Announce quantities reduced on load

**Decision** (user): a silent reduction is a correctness surprise. The shopper left 8 and comes back to 4. Announce it through the polite live region on load, and show a dismissible per-line note, "Reduced to 4 — limited availability". Not a blocking dialog.

**What landed**

- Store: `completeHydration()` replaces the `persist` `onRehydrateStorage` hook. It clamps, records `quantityNotices`, sets `hydrated`, and *returns* the reductions, so the caller can announce without the store holding copy. A notice clears when dismissed or when that line changes, because after that it's stale.
- `connectCartPersistence(store, { onQuantityReduced })` calls back after a load that lowered something. It's guarded by an `active` flag: in React Strict Mode the effect mounts, unmounts, and remounts, and without the guard the first, abandoned load would announce too.
- `CartHydrator` and `CartAnnouncer` (the single polite region; messages are keyed by id, so repeats are re-read) are built and mounted in the root layout. `announce-copy.ts` holds the wording.
- Not yet visible: the per-line note. Its copy (`quantityReducedNote`) and state are ready; `CartLineItem` renders it in the components task.

**Found while testing**: rehydrating wrote once whenever the stored JSON's key order differed from ours, because the cart was equal but the string wasn't. Tabs only ever write canonical order, so this couldn't loop, but it broke "rehydrating never writes". Write-skipping now compares canonical forms.

**Verified in the browser** (dev server): with a saved cart of 8 × product 4 (simulated availability 5), the live region read "… reduced from 8 to 5 — limited availability." once, and storage held 5. Reloading was silent. No console errors.

**Docs**: R6 and data-model §6 now match the five differences from the previous entry. §8 gains `quantityNotices`, and the copy table gains the reduced-on-load rows.

---

## 2026-10-26 — Cart domain and store (FR-006–FR-012, FR-018)

**What landed**

- `lib/stock.ts` holds `MAX_QTY_PER_LINE = 10` (store policy) and `getLineLimit()`. `lib/inventory.ts` holds `InventoryProvider` and `simulatedInventory` (deterministic, 3–20, labelled SIMULATED). They stay separate: `LineLimit.reason` says which rule capped a line.
- `cart/domain` (pure): `addItem`, `increment`, `decrement`, `setQuantity`, `removeLine`, `clampToLimits`, `reconcileWithCatalogue`, `migrateCart`, and selectors (`lineTotalCents`, `totalQuantity`, `subtotalCents`, `lineQuantity`). Max quantity is always an argument.
- `cart/store`: `createCartStore()` (Zustand 5 + `persist`), `cart-storage.ts` (trust boundary), `persisted-cart-schema.ts` (Zod v1), and `connectCartPersistence()` (rehydrate + `storage` listener).
- `lib/image-url.ts`: the `https://fakestoreapi.com` image rule, now shared by the API schema and the saved-cart schema rather than copied.
- `docs/adr-001-state-management.md`, and the spec's edge-case entry for duplicate ids now covers both rules.

**Decisions**

- *Duplicate ids in a saved cart invalidate the whole payload* (user decision, following persisted-cart.md). The catalogue keeps "first wins". The reasoning is recorded in the spec.
- *Storage returns an empty cart, never `null`.* Reading zustand's `persist` source showed that `null` from `getItem` leaves the current state in place. A cart cleared or corrupted in another tab would then survive in this one. R6's wording said `null`.
- *Write-skipping in the storage.* `persist` calls `setItem` on every `setState`, including the drawer and announcements, and when `hydrated` is set. The storage skips a write when the serialised cart equals what's stored, or when the cart is empty and there's no key. Serialisation uses a fixed key order so equal carts produce equal strings. Result: exactly one write per cart change, and rehydrating never echoes back to other tabs.
- *Actions read `get()` at call time*, not the functional `set(state => …)` form R6 describes. zustand updates synchronously, so the guarantee is the same: rapid actions each apply to the previous result. It also lets no-op outcomes skip `set` entirely: no re-render, no write.
- *`migrateCart` returns the current-shape payload, still unvalidated*, and the store validates it. That keeps the Zod persistence schema in `store/` (per the plan) and every version on the same validation path. data-model §6 says `migrateCart` returns a validated Cart.
- *`setQuantity` accepts `string | number`.* With numbers only, `Number('')` is 0, which would clamp to 1 instead of being rejected, as data-model says empty input should be.
- *`reconcileWithCatalogue` also returns the updated cart* (data-model lists only `priceChanges` and `missingIds`).
- *Tests needing browser APIs but not React are named `*.dom.test.ts`* and run in the jsdom project.

**Verified by mutation**: `getItem` returning `null`, no write-skipping, duplicates allowed, eager hydration, no re-clamp after hydration, ignoring `localStorage.clear()`, and keeping an invalid payload in storage. Each made at least one test fail.

**Not done yet**

- Components: `CatalogueSync` (calls `reconcile` only when `source === 'live'`), `CartAnnouncer`, `AddToCartControl`, `CartButton`, `CartDrawer`, `CartLineItem`, announcement copy.
- ~~Re-clamped quantities aren't announced~~ Done (user decision): see the next entry.

---

## 2026-10-26 — Product listing (FR-001 to FR-005)

**What landed**

- `app/page.tsx` awaits `getCatalogue()` and `searchParams`, then runs `parseCatalogueQuery` → `applyCatalogueQuery`. Only the current page of products reaches the client. `loading.tsx` shows a skeleton the same size as the real cards; `error.tsx` shows the error state with `retry()`.
- Pure query layer: `schemas/catalogue-query.ts` (parse, never throws), `query/apply-catalogue-query.ts` (filter → search → sort → paginate, ties broken by id), `query/serialize-catalogue-query.ts` (canonical URL, `withQuery` resets the page), `query/page-window.ts`.
- Components: `ProductCard`, `ProductGrid`, `ProductGridSkeleton`, `EmptyResults`, `Pagination`, `ResultSummary`, `CatalogueFilters` (client), `SnapshotNotice` (client), `ProductListing` (composition).
- `components/ui`: `Button` (+ `buttonClassName` for button-styled links), `Badge`, `Rating`, `Skeleton`, `VisuallyHidden`.
- Design tokens in `globals.css`, light and dark, with one global `:focus-visible` outline. `next.config` `images.remotePatterns` allows only `https://fakestoreapi.com/img/**`.

**Decisions**

- *Testing split (user decision).* Jest can't render the async page, so behaviour is tested at two levels. Pure functions cover filter, sort, pagination and the URL. RTL renders the synchronous components with props. The data path keeps its MSW tests. Page-level checks wait for Playwright. A deterministic URL round-trip test runs 1,000 generated queries with a seeded PRNG; it avoids adding fast-check.
- *Category and sort are controlled inputs in a client component*, not server-rendered selects. An uncontrolled `defaultValue` doesn't follow the URL on Back, and remounting with a `key` drops keyboard focus on every change. State adopts the URL during render when it changes. The one exception is in-progress search text the URL already reflects: "gold " stays "gold " even though the URL says `q=gold`.
- *One owner for the pending search.* Choosing a category cancels the pending debounced search and pushes a URL that includes the typed text. Otherwise the stale debounce would fire afterwards and replace the new URL with old values.
- *`<form role="search">` instead of `<search>`.* jsdom doesn't recognise `<search>`: React logs an error and Testing Library can't find the landmark. Older browsers and assistive tech don't map it either. contracts/ui-components.md and research.md have been updated to match (user decision), along with the client-component filters and the static-shell change in R1.
- *`loading="eager"` + `fetchPriority="high"` for the first row*, not `priority`. Next 16 deprecated `priority`.
- *The filter controls are not in the static shell* (research R1 said they would be). They need the catalogue's categories and the URL's values, so they render inside the `loading.tsx` boundary; the shell is the header and the heading. The build reports `/` as a partial prerender.
- ~~*`error.tsx` imports two components by deep path.*~~ Fixed: `features/catalog/client.ts` is a client-safe public surface (re-exported by `index.ts`), and `error.tsx` imports from it. Checked by building with `error.tsx` pointed at the full index: the build fails (`"use cache"` in a Client Component, via `get-catalogue.ts`). So the boundary is enforced by the build, not just by convention.

**Verified**

- Mutation checks: removing the debounce, using push for search, not cancelling the debounce on select, not syncing from the URL, not resetting the page, not clamping it, case-sensitive search. Each made at least one test fail.
- Real browser (dev server, live API): debounced search updates the URL with no new history entry and keeps focus. Category and sort add history entries, and Back restores both the URL and the controls. `?page=99&sort=bogus&category=toys` falls back to defaults and clamps to the last page. `?q=<script>…` renders as text. Keyboard focus shows the 2px focus-token outline.
- **Not yet in a real browser:** the snapshot notice and the error page. Both need the `CATALOGUE_SOURCE` fixture modes. RTL covers them.

**Surprises**

- The browser pane read "Loading products…" after a full load, even though the content had streamed in hidden. The pane itself was hidden, and the browser held back the reveal until a paint. It wasn't an app bug, but it's a trap when checking streaming in the browser pane.
- With Jest `projects`, coverage counted test files as source (47% overall) until `*.test.*` was excluded explicitly.
- `jest.mock` factories can't use `require` under the lint config. `jest.requireActual` works and is the documented way to reach a real module from a factory.

---

## 2026-10-26 — Duplicate product ids

**Decision** (user): keep the first occurrence of an id, drop later ones, and warn in dev. Cart lines are keyed by product id, so two products sharing one would collide in the cart.

**Detail worth recording**: deduplication happens *after* schema validation. If it ran first, an invalid item could claim an id and cause a later valid item with that id to be dropped too. A separate test pins this ordering. It passed before the fix too, and is there to stop a regression to dedupe-first.

**Test-first**: the duplicate test failed before the change (both items came through) and passes after.

---

## 2026-10-26 — Human Audit

### Unanchored hostname check on product image URLs (security)

The product schema restricts image URLs to fakestoreapi.com so that a spoofed
or compromised API response cannot point next/image at an arbitrary host.

Before:
    image: z.string().url().regex(/https:\/\/fakestoreapi\.com\//)

The problem: a regex without anchors matches anywhere in the string, so
https://fakestoreapi.com.evil.example/x.jpg passes validation. The attacker
controls the real host; our "allowlist" is actually a substring search.

After:
4: * Mirrors one item of GET https://fakestoreapi.com/products, and nothing more (data-model §1).
15:  image: z.url({ protocol: /^https$/, hostname: /^fakestoreapi\.com$/ }),

Verified by running the unanchored pattern against the look-alike host and
confirming it was accepted, then confirming the anchored version rejects it.
A test for the look-alike host is now in the suite.

This is the kind of bug that survives code review: the intent is readable and
every happy-path test passes. It only surfaces if you ask what else the
pattern matches.

## 2026-10-26 — Catalogue data layer (FR-010, FR-013, FR-014)

**What landed**

- `lib/money.ts`: branded `Cents`, `toCents` (the only float → cents conversion), `formatMoney` (fixed `en-US`/USD so server and client render the same string).
- `catalog/schemas/api-product.ts`: Zod schema mirroring the API item. There is no `stock` field and no `.catch()`/`.default()`. Refinements follow data-model §1: `https:` on `fakestoreapi.com` only, rating bounds, non-empty trimmed title and category.
- `catalog/api/fetch-catalogue.ts`: live → bundled snapshot → `CatalogueUnavailableError`. Snapshot results carry `fallbackReason` as plain serialisable data, so it survives `'use cache'`.
- `catalog/api/get-catalogue.ts`: `'use cache'` wrapper with `cacheTag('catalogue')`, `cacheLife('hours')` for live results and a 30s/60s/300s profile for snapshot results.
- `catalog/api/snapshot.json`: raw 200 response captured with `curl`. `snapshot.meta.json` holds the capture time, item count, and SHA-256.
- MSW handlers in `src/test/msw/`: success, 500, 403, non-JSON, wrong-shape JSON, empty array, network error, hang (timeout).

**Decisions**

- *Plan wins over the task prompt, with additions.* The prompt asked for `getProducts()`, a discriminated result that includes a failure variant, and a `live → cached → snapshot` chain. The plan and contract specify `fetchCatalogue()`, which throws `CatalogueUnavailableError`. I kept the plan and added two things from the prompt: the `fallbackReason` on snapshot results, and an injectable fallback. The "cached" tier is the `'use cache'` wrapper, not an in-memory last-known-good copy, because a module-level cache is unreliable on serverless (cold starts, multiple instances).
- *Injectable fallback.* `fetchCatalogue({ fallback: null })` disables the fallback, and any other loader can be passed in. Without this, a working snapshot makes every failure look like success, and `error.tsx` could never be tested.
- *Timeout is injectable too* (`timeoutMs`). The timeout test uses 50 ms against an MSW handler that never responds.
- *Empty array is a source failure*, not an empty catalogue. The contract says so, and an empty 200 from a store API is far more likely to be an outage than a real empty store.

**Surprises**

- `19.99 * 100 === 1998.9999999999998`. Truncation gives 1998. Besides the named case, a test checks every two-decimal price from $0.00 to $9,999.99 (one million values). Mutating `Math.round` to `Math.trunc` fails four tests.
- Sub-cent inputs round the binary double, not the decimal you typed: `toCents(1.005)` is `100`, because `1.005` is stored as `1.00499…`. This is out of contract (the API sends at most 2 dp), so there is no test. A test asserting 100 would lock in a quirk, and one asserting 101 would be wrong.
- MSW 2.15 pulls in ESM-only packages (`rettime`, `until-async`, `@open-draft/deferred-promise`). `next/jest` hard-codes `transformIgnorePatterns`, so `jest.config.mjs` patches the resolved config to let SWC compile those packages. The other option, `transpilePackages`, would also change the app build.
- `z.url({ hostname })` takes a RegExp and doesn't anchor it for you. The schema uses `/^fakestoreapi\.com$/`; an unanchored `/fakestoreapi\.com/` would accept `fakestoreapi.com.evil.example`. There's a test for that look-alike host.

**Verified by mutation** (break the code, check a test fails, restore): `Math.round → Math.trunc`, `price.catch(0)`, `rating.default(...)`, ignoring `fallback: null`, `.loose()` letting `stock` through. Each made at least one test fail.

**Not done yet / open**

- `getCatalogue()` is typechecked and builds, but no route calls it yet. Jest can't run `'use cache'`, so it is excluded from coverage. It gets exercised once `page.tsx` uses it (and in E2E).
- `CATALOGUE_SOURCE=fixture | fixture-large | fixture-broken` (contract) is not implemented. `'fixture'` was left out of `CatalogueSource` until it exists.
- ~~No `server-only` guard~~ Done: `fetch-catalogue.ts` imports `server-only`, so a Client Component that pulls it in fails the build. Jest maps the package to its own `empty.js`, because the real entry throws outside the `react-server` export condition.
- ~~Duplicate product ids~~ Decided: keep the first valid item per id and drop later ones with a dev warning, because cart lines are keyed by id. Now in the spec's edge-case list.
