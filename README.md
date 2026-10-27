# Kibo Cart

A small shopping cart built on the [Fake Store API](https://fakestoreapi.com), written as a Senior UI Engineer
assignment. You can browse and filter the catalogue, add things to a cart, change quantities, and your cart
survives reloads and stays in sync across tabs.

The feature list is deliberately short. Most of the effort went into the parts that usually break: money
arithmetic, untrusted data, what happens when the API is down, keyboard and screen-reader use, and tests that
fail when something is actually wrong.

**Live:** https://kibo-cart.vercel.app
**Repository:** https://github.com/VartikaCoder/kibo-cart

## Running it

You'll need Node 24 (there's an `.nvmrc`).

```bash
npm ci
npm run dev            # http://localhost:3000, live API
```

The checks CI runs:

```bash
npm run lint
npm run typecheck      # generates Next's route types first, so it works on a fresh clone
npm run test:cov       # Jest: unit and component tests, with coverage thresholds
npm run build
```

End-to-end tests run against a real production build with fixed fixture data, so a flaky API can't fail them:

```bash
npm run e2e:install    # once: Playwright's Chromium
npm run e2e
```

`CATALOGUE_SOURCE=fixture` serves that same fixture data in any mode. Any other value is treated as a mistake:
loading the catalogue fails loudly instead of quietly falling back to live data.

## Versions

Exact versions from `package-lock.json`, which is what `npm ci` installs. Where `package.json` allows a range,
it's shown in brackets.

| | Version |
|---|---|
| Node | 24 (`.nvmrc`) |
| Next.js | 16.4.3 |
| React / React DOM | 19.3.0 |
| TypeScript | 5.9.3 (`^5`) |
| Tailwind CSS | 4.3.3 (`^4`) |
| Zustand | 5.0.16 |
| Zod | 4.6.7 |
| Jest | 30.5.2 |
| React Testing Library | 16.3.3 |
| MSW | 2.15.0 |
| Playwright | 1.64.1 |
| axe-core for Playwright | 4.14.0 |
| ESLint | 9.39.5 (`^9`) |

## How it's put together

Next.js (App Router) with TypeScript, Tailwind, Zustand for the cart, and Zod wherever outside data comes in.

- **The listing is rendered on the server.** Filter, search, sort, and page all live in the URL, so links are
  shareable and Back works. Only the current page of 12 products is sent to the browser.
- **Cart rules are plain functions** in `src/features/cart/domain`: no React, no store, no browser APIs. The
  Zustand store is a thin layer that calls them. The reasoning is in
  [ADR-001](docs/adr-001-state-management.md).
- **Features talk through public entry points.** Each feature has an `index.ts` (which may include server-only
  code) and a `client.ts` (safe for Client Components). The build fails if a Client Component pulls in server
  code.

## Decisions worth knowing about

**When the API is down, you get a saved copy of the catalogue, not an error.** fakestoreapi has been seen refusing
requests from cloud hosts, which would take the deployed demo down with it. So the app falls back to a snapshot
of the API, saved in the repo and checked with the same validation as live data. A small notice says it's a
saved copy and how old it is, with a Retry button. You only see the error page (with its own Retry) if the
snapshot is unusable too. So the deployed demo stays usable whether or not the API answers its host.
In practice fakestoreapi's catalogue is effectively static, so the snapshot and a live response are near-identical
and serving the saved copy costs almost nothing. The design doesn't rely on that: the notice, the capture date, and
the revalidation all treat the data as volatile, which is the right assumption for a real commerce catalogue.

**The 10-per-order limit is real; "available" counts are not.** The API has no stock data. The per-line cap of
10 is a store policy. Availability below that comes from a *simulated* inventory (`src/lib/inventory.ts`):
deterministic per product, so it's the same on server and client. Every message based on it says so:
"Only 5 available (demo inventory)". A real inventory API would replace that one file.

**Deliberately not handled: merging cart edits across tabs.** This is the edge case I chose not to solve.
If you change the cart in two tabs, the most recent write wins and the other tab updates to match. I didn't try
to merge. A cart is small, edits in two tabs at once are rare, and a
merge would have to guess intent (did you remove that item, or just not add it in this tab?). Always showing the
latest saved state is easier to predict than a clever merge.

**A large catalogue is paginated, not virtualized.** The listing shows 12 products per page, and the page
number is in the URL. For a storefront, being able to share a link to page 3 of "electronics, cheapest first",
use the Back button, and have search engines crawl each page matters more than infinite scrolling.
Virtualization suits admin grids, where none of that applies and you need thousands of rows on one screen.
Pagination also keeps the payload small: only the current page is sent to the browser.

**The cart is saved in `localStorage`.** It's the only option that both survives closing the browser and fires
a `storage` event in other tabs, which is how the tabs stay in sync. `sessionStorage` is per-tab and gone when
the tab closes. Cookies get sent with every request to a server that has no use for them, and are capped at
about 4 KB. IndexedDB is asynchronous, adds a lot of code for a few kilobytes, and has no cross-tab event, so
sync would need a second mechanism.

**Money is whole cents.** Prices are converted to integer cents once, when the API data comes in, and formatted
only for display. Totals are calculated from the lines every time and never stored.

**The saved cart is treated as untrusted.** Anyone can edit `localStorage`. On every load the cart is parsed,
version-checked, and validated; anything wrong (including duplicate products) throws the whole thing away and
starts empty. If the saved shape ever changes, it gets a new version number, a migration, a test with an
old-format fixture, and a note here. It's still version 1.

## Edge cases from the spec

| Edge case | Where it's covered |
|---|---|
| Rapid repeated clicks | domain test: N adds in a row each count once, then stop at the limit |
| Quantity limits | domain and component tests; E2E for both the policy cap and the simulated limit |
| Stock (simulated vs real) | `stock.test.ts`; announcement copy tests check that "demo inventory" appears exactly where it should |
| Invalid API data | `fetch-catalogue.test.ts` (MSW): bad items dropped, all-bad falls back to the snapshot |
| Duplicate product ids | first wins for API data, the whole cart is rejected for saved data; both tested |
| API unavailable | fallback tested for 500, 403, timeout, bad JSON, wrong shape, and an empty list; error state tested |
| Product no longer exists | **not built**: see "What I'd do with more time" below |
| Corrupted or tampered storage | store tests: bad JSON, unknown version, duplicates, invalid lines all start an empty cart |
| Concurrent edits in two tabs | store tests and an E2E test with two real tabs (updates in under a second) |
| Floating-point money | every two-decimal price from $0.00 to $9,999.99 converts exactly (a million values) |
| Large catalogue | query tests over a generated 500-product catalogue (page clamping, last page) |
| Client-side tampering | caught by the same storage validation; real limits written up in [security notes](docs/security-notes.md) |
| Search input | special characters (`%`, `&`, `#`, `<`, quotes, `.*`, emoji) survive the URL and match literally |

## Success criteria

| | Criterion | Where it stands |
|---|---|---|
| SC-001 | Keyboard-only, landing to updated total in under 30 s | the flow is covered by a keyboard-only E2E test; I haven't timed a person doing it |
| SC-002 | Totals exact to the cent | money and selector tests |
| SC-003 | Zero automated accessibility violations | axe in Playwright (WCAG 2.2 A/AA) on the listing and the open cart: zero |
| SC-004 | Lighthouse mobile performance and accessibility ≥ 90 | deployed: 98 and 100 (median of 3); see [performance notes](docs/performance-notes.md) |
| SC-005 | Changing one cart line doesn't re-render other cards | React Profiler capture of an add-to-cart: only the cart components and one card's control re-render ([image](docs/images/profiler-ranked-add-to-cart.png)). Not checked by an automated test |
| SC-006 | Cart domain ≥ 90% coverage, project ≥ 80% | domain 100% lines / 98.8% branches; project 99.4% / 95.7%. CI enforces both: 90% on the cart domain and 80% on the rest |
| SC-007 | Cart change shows in another tab within 1 s | E2E test with a 1-second limit |

## Tests

About 360 Jest tests (domain, store, schemas, components) and 8 Playwright tests that only cover what jsdom
can't: real storage events between tabs, real focus behaviour in the modal, axe, and the security headers.
I chose Playwright because the cross-tab test needs two tabs in one browser, which Cypress doesn't support
(it runs inside a single tab), and not RTL alone because jsdom has no real `showModal()`, no layout, and no
storage events between tabs.
Network calls are mocked with MSW, never by mocking our own modules.

The coverage thresholds are 90% for the cart domain and 80% for the rest, enforced in CI; actual coverage is about 99% of lines and 96% of branches. Each CI run uploads the HTML report as the `coverage-report` artifact. The
effort went where bugs are silent and expensive: the cart rules, money, and every validation boundary (API,
saved cart, URL). Some files are left out of coverage, each with its reason in `jest.config.mjs`: route files
in `src/app` and the two catalogue loaders that need the Next runtime (`get-catalogue.ts`,
`refresh-catalogue.ts`) are checked by the build and end to end instead; the rest are re-export entry points
(`index.ts`, `client.ts`), type-only modules, test helpers, and the tests themselves. I didn't
chase 100% on UI wiring, because tests written only to execute glue code end up asserting structure rather than
behaviour: they break on harmless refactors and catch little.

Throughout, I checked tests by breaking the code they protect and making sure they failed. The developer log
records 22 of those checks. There's also a guard test that fails if any client component imports Zod directly,
since that once put 98 KB into the page.

GitHub Actions runs lint, typecheck, unit tests with coverage, the build, and the E2E suite on every push and
pull request.

## More documentation

- [Accessibility notes](docs/accessibility-notes.md): structure, focus, the live region, contrast, what axe misses
- [Security notes](docs/security-notes.md): validation, the CSP and how it was checked, `npm audit`, limits of client-side checks
- [Performance notes](docs/performance-notes.md): the Zod bundle investigation, Lighthouse results, what re-renders when the cart changes
- [ADR-001: state management](docs/adr-001-state-management.md)
- [Developer log](developer-log.md): how AI was used, what was checked by hand, and the decisions along the way
- [Code review exercise](review/CODE_REVIEW.md): a before/after component review
- Spec, plan, and contracts: [`specs/001-shopping-cart/`](specs/001-shopping-cart/)

## What I'd do with more time

### Live price reconciliation and "no longer available" lines (FR-018)

Deliberately scoped out. The cart doesn't yet react to catalogue changes after an item is added: there is no
"price changed" note on a line, and no "No longer available" state for products that have disappeared.

- **Why it's low value here:** when fakestoreapi refuses the host, the deployed demo serves the bundled
  snapshot. Its prices never change, and the design deliberately doesn't reconcile against a snapshot
  (research R3), because a saved copy isn't authoritative.
- **Why it isn't free:** the plan's `CatalogueSync` needs the catalogue in the root layout. Fetching it there
  would move uncached data into the layout and cost the prerendered static shell, which currently makes the
  header and page frame instant.
- **What already exists:** the pure `reconcileWithCatalogue()` (tested), the store's `reconcile()` action, and
  the `priceNotices` / `unavailableIds` state, with totals already excluding unavailable lines. What's missing is
  a client leaf that calls `reconcile()` only when `source === 'live'`, plus rendering those two line states.
  I'd load the price index in its own `<Suspense>` boundary so the shell stays static.

This also covers the spec's "Product no longer exists" edge case, which has no UI test for the same reason.

### `zod/mini` for the saved-cart schema

Not done, deliberately. Zod is already out of the initial load: the saved-cart schema is imported on demand,
only when a saved cart exists (docs/performance-notes.md). That on-demand chunk is 30.8 KB transferred.
Rewriting the schema in `zod/mini`'s functional API would save about 40% of it, roughly 12 KB, fetched after the
page has loaded and only by returning visitors with a cart. That's low value, and rewriting a trust-boundary
schema in a different API is real risk. I measured the prototype (the full test suite passed against it) and
left it out.

### Smaller things I noticed and left

- **Retry doesn't report its outcome.** Retry on the snapshot notice expires the cached catalogue and re-renders.
  If the API is still unreachable, the app falls back to the snapshot again and the identical notice comes back.
  That's correct, but it looks exactly like the button doing nothing. It should say what happened through the
  status region ("Still unavailable, showing the saved copy" or "Live catalogue restored"). I found this by
  clicking through the deployed site.
- **Product images are bigger than they need to be on phones.** The cards ask for full-width images, but
  portrait products are shown narrower, so a 370 × 640 image ends up displayed at 191 × 330. The fix is a
  narrower `sizes` value on the cards. I know what it is and haven't done it yet.
- **There are no E2E tests for a 500-product catalogue or for the error page.** The fixture modes for them were
  planned and not built; both paths are covered by unit and component tests instead.
- **Real interaction in component tests.** I didn't add `@testing-library/user-event`, so keyboard and pointer
  behaviour is only exercised for real in Playwright.
- **A screen-reader pass.** Everything is built and tested against roles, names, and live regions, but I haven't
  sat down with VoiceOver or NVDA and used it.
- **Two buttons with the same name.** At quantity 1, a cart line has both "−" (which removes) and a trash button,
  both called "Remove … from cart". They do the same thing, but it's repetitive to hear.
