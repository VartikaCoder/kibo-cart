# Developer log

Working notes, newest first. Each entry records what changed, the decisions behind it, and anything that surprised me.
These are notes; the spec, plan, and ADRs are the authoritative documents.

---

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
- Duplicate product ids from the API are not handled. The spec doesn't cover this; it needs a decision before the cart keys lines by id.
