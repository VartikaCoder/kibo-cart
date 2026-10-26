# Developer log

Working notes, newest first. Each entry records what changed, the decisions behind it, and anything that surprised me.
These are notes; the spec, plan, and ADRs are the authoritative documents.

---

## 2026-10-27 — Playwright E2E suite

**What landed**

- `@playwright/test` 1.64 and `@axe-core/playwright` 4.14, with Chromium. Scripts: `npm run e2e`, `e2e:install` (CI: `--with-deps chromium`), `e2e:report`. CI settings: `forbidOnly`, 2 retries, 1 worker, GitHub reporter, trace on first retry.
- Runs against `next build && next start` with `CATALOGUE_SOURCE=fixture`. `next.config` reads `NEXT_DIST_DIR`, and E2E builds go to `.next-e2e`, so a fixture build can never be served by a plain `npm start`.
- Fixture mode (`lib/env.ts`, `fetchCatalogue({ mode })`): 6 products from the snapshot, same validation, no network. Product 1 is capped by policy (10), product 4 by simulated availability (5), so both limit reasons have real data. An unknown `CATALOGUE_SOURCE` throws rather than falling back to live.

**The suite: 8 tests, each covering what jsdom can't**

| Spec | Covers |
|---|---|
| `cart` core flow | URL filter → add on card → "+" → type 3 in the drawer → subtotal $374.45 (announced and shown) → reload → same lines and total |
| `cart` limits ×2 | real simulated inventory: "+" `aria-disabled`, description "Limit 10 per order" vs "Only 5 available (demo inventory)", click announces the right reason |
| `persistence` cross-tab | two tabs, real `storage` events, both directions, under 1 s (SC-007) |
| `keyboard` | add and adjust by keyboard, open the cart, 15 Tabs never leave the modal (real `showModal` inertness), Escape → focus back on the cart button |
| `a11y` ×2 | axe, WCAG 2.2 A/AA: listing, and drawer open with a line at its limit. **Zero violations on the first run** |
| `a11y` CSP | skips with a reason while there's no CSP header; enforces itself once the headers land |

**Notes**

- One keyboard-test failure on the very first run (cold server, 5 workers) didn't reproduce in 42 parallel repeats or in isolation. The Tab helper now records what it tabbed through, so a recurrence will say why.
- Not built: `fixture-large` and `fixture-broken` (contract updated), and the CI workflow file. Both are separate pieces.

---

## 2026-10-27 — Zod out of the initial client load

**Finding** (user): the client bundle for `/` was 427 KB against a 376 KB scaffold baseline, and `zod` was 98.54 KB of the initial load, about 3× all of `src/`.

**What the trace showed.** The import graph (`next analyze export`) had two client paths, not one. The expected path was the saved-cart schema on rehydrate. The unexpected one: `CatalogueFilters` reused the server's Zod URL parser to tidy its own form values. That's not a trust boundary (the server re-validates every URL), so the rules moved to a Zod-free `query/catalogue-query.ts`, with a parity test against the Zod parser over 500 generated cases.

**What measurement changed.**
- *The filter-form fix bought almost nothing* (98.54 → 98.48 KB). The cart path pulled in the same Zod modules, so one path was invisible while the other existed. It was necessary, not sufficient.
- *`zod/mini` was a real cut* (98 → 59 KB initial; total 395 → 355 KB) with the same rules and tests. But it was still in the initial load.
- *Lazy-loading the schema removed Zod from first visits entirely.* `getItem` imports the schema only when a saved cart exists. Rehydration was already after mount behind placeholders, so going async costs nothing visible. The write-skip check no longer needed the schema: it compares canonical JSON, and validation happens on read.
- *The analyzer then disagreed with itself.* Its Initial-load view still showed Zod at 98.48 KB; its exported graph put Zod only in an `async` group. The browser settled it (production build): with no saved cart, 9 JS files, 157.4 KB transferred, no Zod chunk. With a saved cart, the 30.8 KB Zod chunk arrives at 46 ms, after DOMContentLoaded, and the cart restores.

**Decisions**
- Lazy-load, classic Zod. Validation is unchanged: same schema, same tests, every read.
- Not stacking `zod/mini` on top (user decision): ~12 KB, after load, for returning visitors only, at the cost of rewriting a trust-boundary schema. Recorded in the README.
- Hand-written validation rejected: smallest gain over lazy-loading, and it leaves "Zod at every trust boundary".

**Regression guard**: `client-bundle-guard.test.ts` imports every `'use client'` module with `zod` mocked to throw. Reintroducing either original import fails it (the cart one fails all 6 cart client modules). It finds client modules by their directive, so new ones are covered automatically.

---

## 2026-10-26 — Snapshot age in the fallback notice

**What landed**: the snapshot notice says how old the saved catalogue is ("…from 3 hours ago."), in a `<time dateTime>` whose `title` holds the exact UTC timestamp ("Oct 26, 2026, 2:20 PM UTC").

**Decisions**

- *Hydration-safe by construction.* `page.tsx` calls `connection()`, reads the clock once, and formats on the server. `SnapshotNotice` receives finished strings and never touches `Date`. Formatting lives in a pure `lib/relative-time.ts` that takes `now` as an argument, so it's unit-tested with fixed dates.
- *The capture time travels with the data.* The fallback loader now returns `{ payload, capturedAt }`; the bundled loader reads `snapshot.meta.json`. A snapshot `Catalogue` carries `capturedAt`, validated as ISO 8601; invalid or missing → `null`, and the notice drops the "from …" part rather than showing a wrong age.
- *`numeric: 'always'`*, so it's never "from now" (which reads as the future) or "from yesterday". Anything under a minute, or in the future from clock skew, shows "1 minute ago". Units round down.
- *UTC in the title, labelled as UTC.* The server's time zone isn't the reader's. A test runs the formatter under `TZ=Asia/Tokyo` and gets the same result.
- *It doesn't tick.* The age is correct when the page renders and is recomputed on any navigation or Retry. A live-updating clock would need client-side time, which reintroduces the hydration problem this avoids.

**Softened (user request, same day)**: the notice is now informational rather than a warning. Changes: its own neutral `--info*` tokens instead of amber, a single slim row (46 px on desktop), an info icon, the second sentence in a muted tone, and Retry as a compact text button (36 px tall, above the 24 px minimum target). Measured contrast: light ink 9.6:1, muted 7.1:1, Retry 6.2:1; dark 11.7 / 6.7 / 9.6. Still `role="status"`. Amber `--notice*` stays for the per-line cart notes. `Button` gained `size="sm"` and a `ghost` variant.

**Verified in the browser**: a dev server with the API forced down (`dev-api-down` in `.claude/launch.json`: a dead `HTTPS_PROXY` with `NODE_USE_ENV_PROXY=1`). The server HTML and the hydrated DOM both read "…from 3 hours ago." with the same `title` and `dateTime`. No hydration warnings, no console errors.

---

## 2026-10-26 — Cart UI components (FR-006–FR-009, FR-017, US2)

**What landed**

- `components/ui`: `IconButton` (an accessible name is required by its type), `QuantityStepper` (no cart knowledge; "+" at the max is `aria-disabled` with `aria-describedby` → the visible reason), `Drawer` (native modal `<dialog>`), and decorative `aria-hidden` icons.
- `cart/components`: `AddToCartControl` on each product card, `CartButton` in the header, `CartDrawer`, `CartLineItem` (stepper, Remove, line total, reduced-quantity note with dismiss), totals, and the empty state.
- `cart-commands.ts`: run a store action, then announce its outcome through `CartAnnouncer`. `cartAnnouncement()` covers every outcome in the contract's copy table; unchanged and not-found stay silent.

**Decisions**

- *One source for line limits.* `CartLineItem` only knows a product id, so the store exposes `lineLimit(productId)`, and `AddToCartControl` uses the same lookup. The contract has the card receive `limit` as a prop from the server; that would be a second inventory path.
- *Focus.* Add → focus moves to the new stepper's "+". "−" at 1 → back to "Add". In the drawer, removing a line → next line's Remove, else previous, else the empty-state message (`tabIndex=-1`). Each one commits with `flushSync`, so the new UI exists before focus moves.
- *Actions are blocked until the saved cart loads.* "Add" is `aria-disabled` until `hydrated`: an earlier add would be overwritten when the saved cart loads.
- *Visible "Add to cart" with the title visually hidden inside it,* so the accessible name is "Add {title} to cart" (contract) and still contains the visible words.
- *At quantity 1 a line has two controls named "Remove {title} from cart"* ("−" and the trash button), as the contract specifies. Both do the same thing, so the shared name is accurate.

**Bug found in the browser, fixed test-first**: after Escape, the drawer was shut but the store still said open, so an immediate click on the cart button did nothing. Browsers fire `close` as a queued task, *after* Escape, and state was waiting for it. The jsdom stand-in fired `close` synchronously, which hid this. The fix: the stand-in now fires `close` asynchronously, like browsers. Every close path (button, backdrop, Escape via `cancel`) updates state synchronously, and the native `close` only restores focus. The new tests fail on the old code and pass on the fix.

**Verified in the browser**: add → focus on "+", announced, badge "Cart, 1 item", saved. "+" announces the new subtotal. The drawer opens modal with focus inside, eight Tabs stay inside it, and Escape closes it and returns focus to the cart button. Escape then an immediate reopen works. Removing the last line focuses the empty state and saves an empty cart.

**Not done**

- `CatalogueSync` (live price reconciliation): **scoped out** (user decision). The deployed demo usually serves the static snapshot, and fetching the catalogue in the layout would cost the static shell. Recorded in the README under "What I'd do with more time"; the domain and store support stays in place.
- Full keyboard flow, focus containment, and axe checks belong to Playwright (next).

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

**Wording revised** (user decision, same day): "limited availability" didn't say the stock is simulated. All availability copy now uses R8's wording with the demo qualifier: "Reduced to 4 — only 4 available (demo inventory)", "Only N available (demo inventory)". The policy cap stays "Limit 10 per order", with no qualifier, because it's real. One `DEMO_INVENTORY` constant feeds every availability string, and a test checks that each availability message contains it and no policy message does. The quotes above show the original wording.

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
