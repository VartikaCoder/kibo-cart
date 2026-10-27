# Developer log

Working notes, newest first. Each entry records what changed, the decisions behind it, and anything that surprised me.
These are notes; the spec, plan, and ADRs are the authoritative documents.

---

## Summary

This section answers the four parts of the AI-augmentation requirement. Each point refers to the dated entry
below that holds the detail, as "date — heading". Quotes marked "session transcript" come from the AI coding
session itself, not from files in the repo.

### AI Strategy

Direction and review were themselves AI-assisted: a second session acted as a sounding board for scoping and
for reviewing the agent's output. Where an entry says I required or rejected something, the decision was mine;
the reasoning was often worked out in that second session. The two disagreed more than once — the data-layer
prompt contradicted the generated plan, and at least one claim from the review session turned out to be
unsupported and was removed (Verification, "A correction to this log").

**How context was supplied.**
- `CLAUDE.md` holds the standing constraints: stack, folder and dependency rules, money as integer cents, the
  stock/inventory split, state, security, accessibility, testing rules, and how the agent should work.
- `.specify/memory/constitution.md` holds the principles. `specs/001-shopping-cart/` (spec, plan, research,
  data model) is the authoritative spec, and `specs/001-shopping-cart/contracts/` defines the interfaces
  (catalogue API, persisted cart, UI components, URL params). `CLAUDE.md` says to stop and ask when it and the
  spec disagree.
- These files were in use, but not yet tracked, from the start. They were first committed in `e921a99`
  (26 Oct, 20:26), 33 minutes after the first data-layer commit, `00744b6` (19:53). Two things show they
  existed earlier. `00744b6` already cites `contracts/catalogue-api.md` and data-model §1. And the agent's own
  conduct: at 19:48, before writing any code, it stopped to ask before installing Zod, Jest and MSW, and
  justified them as "CLAUDE.md's approved stack". The spec, plan and contracts don't tell it to ask before
  installing (the constitution asks only for a written justification); `CLAUDE.md` does ("Do not add a
  dependency without asking first"). That question is in the session transcript, not in git: contemporaneous,
  but circumstantial for anyone who has only the repository.
- The dependency rule ("Do not add a dependency without asking first…", `CLAUDE.md`; "No new dependency without
  a written justification", constitution) made every install a stop-and-ask point. In the session transcript
  the agent asked before installing Zod/Jest/MSW, the four React Testing Library / jsdom packages, and
  Zustand.

**How prompting differed by task type.**
- *Architecture*: the agent presents options and trade-offs, and I decide (`CLAUDE.md`: "present the
  options briefly and wait"). The decisions are marked "(my decision)" in the entries: the testing split (26 Oct —
  Product listing), duplicate-id rules (26 Oct — Cart domain and store), scoping out `CatalogueSync` (26 Oct —
  Cart UI components), and not stacking `zod/mini` (26 Oct — Zod out of the initial client load).
- *Implementation*: tight constraints plus the schemas and contracts (data model, `contracts/`).
- *Tests*: describe behaviour and ban implementation detail (`CLAUDE.md` testing rules: test behaviour not
  implementation, `getByRole` before `getByTestId`, no snapshot tests, MSW not module mocks, never weaken a
  test to make it pass).

**Iterated prompt: the catalogue data layer** (26 Oct — Catalogue data layer, "Plan wins over the task
prompt, with additions"). Both versions are from the session transcript.

Why the first attempt wasn't good enough: I wrote it without reading the plan the agent had generated, so it
contradicted it. The revision was collaborative, not a solo rewrite (see the disclosure above).

*Version 1*, the task prompt (item 4 of 6):

> `src/features/catalog/api/get-products.ts` — fetch with revalidate, validate with Zod, drop invalid items
> (log in dev), and the fallback chain live → cached → snapshot → error. Return a discriminated result that
> tells the caller the source used and the reason for any fallback. The fallback must be injectable so tests
> can still exercise the real error path.

This contradicted `contracts/catalogue-api.md` on naming (`fetchCatalogue()`), structure (a `Catalogue`
result, caching in a separate `'use cache'` wrapper), and error handling (`CatalogueUnavailableError` thrown
when every source fails), and on file names. The agent stopped rather than guessing, set out the conflict,
and offered three options: the plan plus two additions from my prompt, my prompt literally, or my names with
the plan's behaviour. I chose the first, which it had recommended: the plan's structure, plus the two
requirements the plan lacked (a `fallbackReason` on snapshot results and an injectable fallback, so tests can
still reach the real error path). That option, worded by the agent, became the working instruction:

*Version 2*, the option chosen:

> **Plan, plus brief's additions (Recommended).** fetchCatalogue() per the contract, with an added
> `fallbackReason` on snapshot results and an injectable snapshot loader. It throws CatalogueUnavailableError
> so error.tsx works. 'Cached' stays with the 'use cache' wrapper, so there's no module-level memory cache.
> Plan's file names.

### Human Audit

Three corrections. Each shows the code as the agent first committed it and as it ended up, and each is
structural: performance, correctness, architecture.

**1. Zod in every first page load (performance).** Details: 26 Oct — Zod out of the initial client load;
`docs/performance-notes.md`.

I found it: the client bundle for `/` was 427 KB against a 376 KB scaffold baseline, and `zod` alone
was 98.54 KB of the initial load. The agent had put Zod on the client in two places.

*Before*: the filter form reused the server's Zod URL parser to tidy its own values
(`src/features/catalog/components/catalogue-filters.tsx`, before `db29eda`):

```tsx
import { type CatalogueQuery, parseCatalogueQuery } from '../schemas/catalogue-query';

/** Runs form values through the same parser as the URL, so trimming/truncation/validation match. */
function normalise(fields: { category: string | null; q: string; sort: string }, categories: string[]): CatalogueQuery {
  return parseCatalogueQuery({ category: fields.category ?? undefined, q: fields.q, sort: fields.sort }, categories);
}
```

Every cart component also reached the saved-cart schema through a static import
(`src/features/cart/store/cart-storage.ts`, before `421cd6c`):

```ts
import { type PersistedCart, PersistedCartSchema } from './persisted-cart-schema';
```

*After*: the form uses Zod-free rules (`query/catalogue-query.ts`), with a parity test against the Zod parser
over 500 generated cases. That's safe because the form isn't a trust boundary: the server re-validates every
URL. The saved-cart schema is now imported only when a saved cart is actually read:

```ts
// src/features/cart/store/cart-storage.ts
import type { PersistedCart } from './persisted-cart-schema';
…
const { PersistedCartSchema } = await import('./persisted-cart-schema');
```

Measurement drove the rework, not the first fix. Removing the filter-form path alone saved 0.06 KB, because
the cart path pulled in the same Zod modules. Now a first visit downloads no Zod at all (157.4 KB of
JavaScript transferred). A returning visitor with a saved cart fetches a 30.8 KB chunk after
DOMContentLoaded. `client-bundle-guard.test.ts` fails CI if any client module imports Zod statically again.

**2. Silent quantity reductions on load (correctness/accessibility).** Details: 26 Oct — Announce quantities
reduced on load.

*Before*: as first committed, the store clamped saved quantities to current limits and told no one
(`src/features/cart/store/cart-store.ts` at `ebff036`):

```ts
function afterHydration() {
  const state = store.getState();
  const { cart } = domain.clampToLimits(state, (productId) => limitFor(productId).max);
  store.setState(cart === state ? { hydrated: true } : { hydrated: true, lines: cart.lines });
}
```

The agent raised this as an open question. I required three things: announce it through the live
region, show a dismissible note on the line, and never block with a dialog. Changing a shopper's data
silently is a trust problem: "The shopper left 8 and comes back to 4".

*After*: the reductions are returned and announced:

```ts
// src/features/cart/store/cart-persistence.ts
const reductions = store.getState().completeHydration();
if (reductions.length > 0) onQuantityReduced?.(reductions);
```

**3. A broken dependency rule, documented instead of fixed (architecture).** Details: 26 Oct — Product listing
("Decisions").

`CLAUDE.md` says code outside a feature reaches it only through its public entry point, never by deep paths.
The agent's error boundary deep-imported two catalogue components. It explained why in a comment and logged
it as a decision (`0bc955f`).

*Before*:

```tsx
// src/app/error.tsx
import { CatalogueError } from '@/features/catalog/components/catalogue-error';
import { CatalogueHeading } from '@/features/catalog/components/catalogue-heading';

// Error boundaries must be Client Components, so this imports the two client-safe leaves directly
// rather than through the feature index (which also exports server-only code).
```

The reason was real: `index.ts` exports server-only code, which a Client Component can't import. I didn't
catch this; the agent reported it. Its report listed five departures from the plan for me to check and asked
for a decision on the first three (update the contracts, or revert). This was number 4, described with a
possible fix ("A separate client-safe entry point would fix this") but left in place. My part was the
decision: fix it rather than keep it as a documented exception, because that is how a dependency rule wears
away. My reply, in the session transcript: "Fix 4: add a client-safe entry point so error.tsx imports through
a public surface, not deep paths." The fix (`66a4e5c`, 20:55) landed four minutes after the listing commit
(`0bc955f`, 20:51). It gives the feature a second public surface, `features/catalog/client.ts`, for Client
Components; `index.ts` re-exports it.

*After*:

```tsx
// src/app/error.tsx
import { CatalogueError, CatalogueHeading } from '@/features/catalog/client';
```

The build now enforces the boundary, not just convention: pointing `error.tsx` at the full index fails the
build (`"use cache"` in a Client Component). `CLAUDE.md` gained the `client.ts` rule in `99d1d5b`.

### Verification

**How the tests were generated.** The agent wrote the edge-case tests from the spec's "Edge Cases" list, under
a standing rule in `CLAUDE.md`: every listed edge case gets a test, or a written reason in the README for why
it doesn't. The README's edge-case table maps each one to its tests, or to "not built". The tests were asked
for as behaviour (what the user sees, what a function returns), with MSW for the network and no snapshots.

**How they were checked.** Passing tests weren't taken as evidence. Each guarantee was broken on purpose, the
suite had to fail, and the code was restored. Mutation sets recorded in the log:

| Entry | Mutations | Result |
|---|---|---|
| 26 Oct — Catalogue data layer | 5 (`Math.round → Math.trunc`, `price.catch(0)`, `rating.default(...)`, ignoring `fallback: null`, `.loose()` letting `stock` through) | each failed ≥ 1 test |
| 26 Oct — Product listing | 7 (debounce removed, push for search, debounce not cancelled on select, no URL sync, page not reset, page not clamped, case-sensitive search) | each failed ≥ 1 test |
| 26 Oct — Cart domain and store | 7 (`getItem` → `null`, no write-skipping, duplicates allowed, eager hydration, no re-clamp, `localStorage.clear()` ignored, invalid payload kept) | each failed ≥ 1 test |
| 26 Oct — Zod out of the initial client load | 2 (each original static Zod import reintroduced) | the cart one fails all 6 cart client modules |
| 27 Oct — Security | 1 (`style-src-attr` removed) | CSP E2E test fails with 50 violations |

That's 22 recorded mutations. Each was reverted after the check, so the record is this log, not git. One
was re-run on 27 Oct as a spot check: `Math.round → Math.trunc` in `toCents` still fails exactly four tests.
Two bug fixes were done test-first: duplicate product ids (26 Oct — Duplicate product ids: "the duplicate test
failed before the change") and the Escape race below. Commits are per task, not per red-green cycle. So git
shows each test landing in the same commit as its fix, and the failing first run is recorded here, not in the
history.

Two tests were labelled for what they actually prove:
- The dedupe-ordering test passed before the fix as well, so it's recorded as a regression guard, not as
  evidence for the fix (26 Oct — Duplicate product ids).
- `toCents(1.005)` deliberately has no test. Asserting 100 would lock in a floating-point quirk, and asserting
  101 would be wrong (26 Oct — Catalogue data layer, Surprises).

**`client-bundle-guard.test.ts`**: imports every `'use client'` module with `zod` mocked to throw, so a static
Zod import anywhere in a client module's graph fails CI. It finds client modules by their directive, so new
ones are covered (26 Oct — Zod out of the initial client load).

**A validation hazard, pinned with a test**: `z.url({ hostname })` takes a RegExp and doesn't anchor it, so
`/fakestoreapi\.com/` would accept `https://fakestoreapi.com.evil.example/…`. The schema was anchored
(`/^fakestoreapi\.com$/`) from its first commit, and a look-alike-host test in `api-product.test.ts` keeps it
so (26 Oct — Catalogue data layer, Surprises).

**Strongest case: the Escape race** (26 Oct — Cart UI components, "Bug found in the browser, fixed
test-first"). After Escape, the drawer was shut but the store still said open, so an immediate click on the cart
button did nothing. Browsers fire `close` as a queued task; the jsdom `<dialog>` stand-in fired it
synchronously, which hid the bug from the component tests. The stand-in was changed to fire `close`
asynchronously, like browsers; the new tests failed on the old code; only then was the fix (every close path
updates state synchronously) accepted.

**Evidence discipline**: two responsive screenshot sets were nearly kept that misrepresented the app. One
captured the loading skeleton instead of the listing; the other was labelled "snapshot" but was serving cached
live data. Both were deleted and re-taken rather than used (27 Oct — Responsive and Lighthouse verification).

**A correction to this log.** From `0bc955f` (26 Oct), the 26 Oct entry now titled "Image hostname check
(validation hazard)" was headed "Human Audit". It showed an unanchored
`z.string().url().regex(/https:\/\/fakestoreapi\.com\//)` as a "Before" that had been caught and fixed. No
source commit ever contained that code: the schema was anchored from its first commit (`00744b6`). The agent
found the mismatch on 27 Oct while checking this summary against `git log`, and flagged it instead of reusing
the snippet. The entry was corrected in `5663a3d`, and the audits above use only what the history supports.
The original wording is still in git.

### A Disagreement

**Duplicate product ids in a saved cart** (26 Oct — Cart domain and store, "Decisions"; the reasoning is in
the spec's edge-case list).

The cart brief said "Duplicate product ids: first wins, later ones dropped." `contracts/persisted-cart.md` said
the opposite: reject the whole payload. The agent noticed the conflict, asked, and recommended the brief's
rule:

> First wins, drop later (Recommended): Follows your brief and matches the catalogue rule; one bad line
> doesn't wipe a real cart. *(session transcript)*

I overruled it. Catalogue data is third-party, and partial success is fine there: drop the bad item
and keep the rest. A saved cart is data we wrote ourselves, so a duplicate means it was corrupted or tampered
with. Nothing then says which line reflects what the shopper meant. Keeping the "first" one could silently
change a quantity or price they never chose. So the same input gets two rules, depending on its source:

```ts
// src/features/cart/store/persisted-cart-schema.ts
// Unlike the catalogue (first wins), duplicates here mean the payload can't be trusted at all.
.refine((lines) => new Set(lines.map((l) => l.productId)).size === lines.length, 'duplicate productId'),
```

The cost is accepted on purpose: a cart with one duplicated line is lost entirely and starts empty. Both
rules are tested.

---

## 2026-10-27 — Responsive and Lighthouse verification (SC-004)

**Two production variants.**
- *Live*: `.next`, live API, 20 products, so pagination appears.
- *API-blocked*: so the snapshot notice shows. Blocking the API only at runtime didn't work: the build had already
  cached the live catalogue, so the "snapshot" server served live data. The working variant is built *and*
  served with a dead `HTTPS_PROXY` (`NODE_USE_ENV_PROXY=1`), Google Fonts exempted via `NO_PROXY` so
  `next/font` still downloads, into a temporary `.next-snapshot`. Confirmed by the route's 1m/5m snapshot cache
  lifetime and the notice in the HTML. The directory was deleted afterwards, and the `tsconfig.json` type paths
  the build added were reverted.

**Responsive, at 375, 768, and 1280 px** (Playwright, touch emulation at the two narrower widths), both variants:
- no horizontal scroll;
- no interactive target under 24 × 24 px (filters and steppers are 44 px);
- the filter controls stay inside the viewport and work;
- pagination fits and navigates;
- the drawer is full-screen at 375 (375 × 812) and a 448 px side panel at larger widths, and closes by tap and by
  Escape;
- the snapshot notice wraps to three lines at 375 px without breaking the layout.

18 screenshots in `docs/images/responsive-*`.

**Cosmetic findings, fixed separately (`a12f151`).**
- *"Add  to cart"*: the visually hidden title split the label into two flex items, so `Button`'s `gap-2` showed
  as an 8 px space. The label is now one element: 3.4 px, one space, measured in Chromium.
- *"All Categories"*: CSS `capitalize` made the select differ from its source string. Removed. **No test**,
  as an exception to the every-bug-fix-gets-a-test rule. The defect existed only in CSS rendering: jsdom
  doesn't apply `text-transform`, so an RTL test reads "All categories" before and after the fix and can't fail
  first. Asserting the class is gone would test implementation. The listing screenshots re-taken in the same
  commit show the corrected "All categories".
- *Reported, not changed*: two trash icons on a line at quantity 1 ("−" as remove, plus Remove), as the contract
  specifies.

**Lighthouse 13.5.0, mobile preset, 3 runs per target.**
- *Deployed*: performance 94 / 98 / 98, median **98**.
- *Local `next start`*: 93 / 95 / 91, median **93**.
- *Accessibility, best practices, and SEO*: 100 in all six runs.
- *Metrics* (median runs): deployed LCP 2.4 s, CLS 0, TBT 30 ms; local LCP 3.2 s.
- *LCP element*: the first card's image every time.
- **SC-004 (performance and accessibility ≥ 90 on mobile) verified.** Local scores lower despite tiny observed
  load phases. The likely cause is Lighthouse's simulated throttling of HTTP/1.1 on localhost vs Vercel's
  HTTP/2 CDN; not isolated.
- *Suggestions*: measured and declined, with the reasons in `docs/performance-notes.md`. One is
  **identified, fix known, not applied**: the cards' `sizes` hint over-fetches portrait images (e.g.
  370 × 640 served, 191 × 330 shown).

**Evidence discipline.** Two screenshot sets were nearly kept that misrepresented the app. One captured the
loading skeleton (the script waited for the cart button, which is in the layout, not for the streamed product
grid). The other was labelled "snapshot" but served cached live data. Both were deleted and re-taken.

**Slip: the re-take that silently did nothing.** After the cosmetic fixes, the screenshot re-take looped over
`"live 3002" "snapshot 3003"` with `set -- $v`. zsh doesn't word-split unquoted variables, so the port was
empty, the script failed, and an output filter hid the error. `git status` showing no changed images exposed it.
I re-ran it, and checked file timestamps before trusting the result.

---

## 2026-10-27 — CI workflow

`.github/workflows/ci.yml` runs on every push and PR, as two parallel jobs, and cancels superseded runs on the same ref.
- **`check`**: `npm ci` → lint → typecheck → `test:cov` (enforces coverage thresholds) → build.
- **`e2e`**: `npm ci` → `npm run e2e:install` → `npm run e2e`. It uploads the Playwright report and traces unless the run was cancelled.

Caching: npm via `setup-node` (keyed on the lockfile), and Playwright browsers in `~/.cache/ms-playwright`, keyed on the installed Playwright version so an upgrade re-downloads. `e2e:install` always runs: on a cache hit it skips the download but still installs the OS packages, which live outside the cache. Node comes from `.nvmrc` (24, as local). Checked locally: the workflow parses, every script it calls exists, and `CI=true npm run e2e` passes with the CI settings (1 worker, retries, GitHub annotations). Not yet run on GitHub.

**First run on GitHub (330a55c): E2E passed and the `check` job failed at typecheck.** The errors were `Cannot find name 'PageProps'` / `'LayoutProps'`. Those are global types Next generates into `.next/types`, wired up by the gitignored `next-env.d.ts`, and they only exist after `next dev` or `next build`. Locally they always existed, so typecheck passed; CI typechecks a fresh checkout before building. I reproduced it in a clean git worktree (same two errors). The fix: `"typecheck": "next typegen && tsc --noEmit"`, which passes in the clean worktree, so the script no longer depends on a prior build. Lesson: "passes locally" tested a dirty tree. The worktree reproduction is the check I should have run before calling the workflow verified.

Same run's warnings, fixed: the v4 actions run on deprecated Node 20, so they're now `checkout@v7`, `setup-node@v7`, `cache@v6`, `upload-artifact@v7` (all Node 24; I checked each one's inputs against its `action.yml`). `ubuntu-latest` is migrating to Ubuntu 26, so the runner is pinned to `ubuntu-24.04`, so the OS under Playwright's system dependencies changes only on purpose.

---

## 2026-10-27 — Security: CSP, headers, audit

**What landed**: static CSP plus `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` for every route; the CSP E2E test now enforces; `react/no-danger` is a lint error; `docs/security-notes.md`.

**Verified, not guessed.** A scratch Playwright probe recorded every `securitypolicyviolation` while browsing, adding to cart, opening the drawer, and reloading against a production build. I started from `'self'` everywhere.
- *Strictest policy*: 7 inline scripts blocked, and **the page never hydrated**. So `script-src 'unsafe-inline'` is required (R10 confirmed).
- *Then*: 12 `style-src-attr` violations (`next/image` `fill` and the rating bar), and one `eval` from Zod's JIT probe in the lazy chunk.
- *Final*: `style-src-attr 'unsafe-inline'` (attributes only; `<style>` stays blocked) and `z.config({ jitless: true })` gave **0 violations**.
- *Dev server*: 33 inline `<style>` violations from Next's dev-tools overlay, so a dev-only `style-src 'unsafe-inline'` → 0.

**Where the plan was wrong**: R10 expected `img-src … https://fakestoreapi.com data:`. Neither is needed, because every image comes through `/_next/image`. R10 also allowed all inline styles where attributes suffice. R10 is revised.

**Surprise**: Zod v4 probes `new Function` to decide whether to JIT. It swallows the error, but the browser still reports a CSP violation, so the E2E test would have failed on every saved-cart read. Zod has a `jitless` option for exactly this, and its source comment names strict CSPs.

**CSP test**: no longer skips. It asserts the headers (and no `unsafe-eval` in production), browses, adds, opens the drawer, and reloads to cover the lazy validation. Removing `style-src-attr` makes it fail with 50 violations, as checked.

**`npm audit`**: 0 vulnerabilities across the 769 packages it counts from the lockfile (25 production), and 0 with `--omit=dev` (figures from a re-run on 2026-10-27, npm 11.19.0). The 679 and 30 first written here were also right, but they count something else: `npm ls` lists the 679 packages actually installed (30 production), while `npm audit` counts every lockfile entry, including 101 optional platform packages that aren't installed on this machine. Three install scripts (`@parcel/watcher`, `msw`, `unrs-resolver`) are left unapproved under npm 11, because everything works without them. Reasons are in the security notes.

**Not done**: nonce or SRI script-src (trade-off in the security notes, §4); `upgrade-insecure-requests` (it would upgrade the http localhost E2E server; production is HTTPS-only on Vercel).

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

## 2026-10-26 — Zod out of the initial client load

**Finding** (mine): the client bundle for `/` was 427 KB against a 376 KB scaffold baseline, and `zod` was 98.54 KB of the initial load, about 3× all of `src/`.

**What the trace showed.** The import graph (`next analyze export`) had two client paths, not one. The expected path was the saved-cart schema on rehydrate. The unexpected one: `CatalogueFilters` reused the server's Zod URL parser to tidy its own form values. That's not a trust boundary (the server re-validates every URL), so the rules moved to a Zod-free `query/catalogue-query.ts`, with a parity test against the Zod parser over 500 generated cases.

**What measurement changed.**
- *The filter-form fix bought almost nothing* (98.54 → 98.48 KB). The cart path pulled in the same Zod modules, so one path was invisible while the other existed. It was necessary, not sufficient.
- *`zod/mini` was a real cut* (98 → 59 KB initial; total 395 → 355 KB) with the same rules and tests. But it was still in the initial load.
- *Lazy-loading the schema removed Zod from first visits entirely.* `getItem` imports the schema only when a saved cart exists. Rehydration was already after mount behind placeholders, so going async costs nothing visible. The write-skip check no longer needed the schema: it compares canonical JSON, and validation happens on read.
- *The analyzer then disagreed with itself.* Its Initial-load view still showed Zod at 98.48 KB; its exported graph put Zod only in an `async` group. The browser settled it (production build): with no saved cart, 9 JS files, 157.4 KB transferred, no Zod chunk. With a saved cart, the 30.8 KB Zod chunk arrives at 46 ms, after DOMContentLoaded, and the cart restores.

**Decisions**
- Lazy-load, classic Zod. Validation is unchanged: same schema, same tests, every read.
- Not stacking `zod/mini` on top (my decision): ~12 KB, after load, for returning visitors only, at the cost of rewriting a trust-boundary schema. Recorded in the README.
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

**Softened (my request, same day)**: the notice is now informational rather than a warning. Changes: its own neutral `--info*` tokens instead of amber, a single slim row (46 px on desktop), an info icon, the second sentence in a muted tone, and Retry as a compact text button (36 px tall, above the 24 px minimum target). Measured contrast: light ink 9.6:1, muted 7.1:1, Retry 6.2:1; dark 11.7 / 6.7 / 9.6. Still `role="status"`. Amber `--notice*` stays for the per-line cart notes. `Button` gained `size="sm"` and a `ghost` variant.

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

- `CatalogueSync` (live price reconciliation): **scoped out** (my decision). The deployed demo usually serves the static snapshot, and fetching the catalogue in the layout would cost the static shell. Recorded in the README under "What I'd do with more time"; the domain and store support stays in place.
- Full keyboard flow, focus containment, and axe checks belong to Playwright (next).

---

## 2026-10-26 — Announce quantities reduced on load

**Decision** (mine): a silent reduction is a correctness surprise. The shopper left 8 and comes back to 4. Announce it through the polite live region on load, and show a dismissible per-line note, "Reduced to 4 — limited availability". Not a blocking dialog.

**What landed**

- Store: `completeHydration()` replaces the `persist` `onRehydrateStorage` hook. It clamps, records `quantityNotices`, sets `hydrated`, and *returns* the reductions, so the caller can announce without the store holding copy. A notice clears when dismissed or when that line changes, because after that it's stale.
- `connectCartPersistence(store, { onQuantityReduced })` calls back after a load that lowered something. It's guarded by an `active` flag: in React Strict Mode the effect mounts, unmounts, and remounts, and without the guard the first, abandoned load would announce too.
- `CartHydrator` and `CartAnnouncer` (the single polite region; messages are keyed by id, so repeats are re-read) are built and mounted in the root layout. `announce-copy.ts` holds the wording.
- Not yet visible: the per-line note. Its copy (`quantityReducedNote`) and state are ready; `CartLineItem` renders it in the components task.

**Found while testing**: rehydrating wrote once whenever the stored JSON's key order differed from ours, because the cart was equal but the string wasn't. Tabs only ever write canonical order, so this couldn't loop, but it broke "rehydrating never writes". Write-skipping now compares canonical forms.

**Verified in the browser** (dev server): with a saved cart of 8 × product 4 (simulated availability 5), the live region read "… reduced from 8 to 5 — limited availability." once, and storage held 5. Reloading was silent. No console errors.

**Wording revised** (my decision, same day): "limited availability" didn't say the stock is simulated. All availability copy now uses R8's wording with the demo qualifier: "Reduced to 4 — only 4 available (demo inventory)", "Only N available (demo inventory)". The policy cap stays "Limit 10 per order", with no qualifier, because it's real. One `DEMO_INVENTORY` constant feeds every availability string, and a test checks that each availability message contains it and no policy message does. The quotes above show the original wording.

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

- *Duplicate ids in a saved cart invalidate the whole payload* (my decision, following persisted-cart.md). The catalogue keeps "first wins". The reasoning is recorded in the spec.
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
- ~~Re-clamped quantities aren't announced~~ Done (my decision): see the next entry.

---

## 2026-10-26 — Product listing (FR-001 to FR-005)

**What landed**

- `app/page.tsx` awaits `getCatalogue()` and `searchParams`, then runs `parseCatalogueQuery` → `applyCatalogueQuery`. Only the current page of products reaches the client. `loading.tsx` shows a skeleton the same size as the real cards; `error.tsx` shows the error state with `retry()`.
- Pure query layer: `schemas/catalogue-query.ts` (parse, never throws), `query/apply-catalogue-query.ts` (filter → search → sort → paginate, ties broken by id), `query/serialize-catalogue-query.ts` (canonical URL, `withQuery` resets the page), `query/page-window.ts`.
- Components: `ProductCard`, `ProductGrid`, `ProductGridSkeleton`, `EmptyResults`, `Pagination`, `ResultSummary`, `CatalogueFilters` (client), `SnapshotNotice` (client), `ProductListing` (composition).
- `components/ui`: `Button` (+ `buttonClassName` for button-styled links), `Badge`, `Rating`, `Skeleton`, `VisuallyHidden`.
- Design tokens in `globals.css`, light and dark, with one global `:focus-visible` outline. `next.config` `images.remotePatterns` allows only `https://fakestoreapi.com/img/**`.

**Decisions**

- *Testing split (my decision).* Jest can't render the async page, so behaviour is tested at two levels. Pure functions cover filter, sort, pagination and the URL. RTL renders the synchronous components with props. The data path keeps its MSW tests. Page-level checks wait for Playwright. A deterministic URL round-trip test runs 1,000 generated queries with a seeded PRNG; it avoids adding fast-check.
- *Category and sort are controlled inputs in a client component*, not server-rendered selects. An uncontrolled `defaultValue` doesn't follow the URL on Back, and remounting with a `key` drops keyboard focus on every change. State adopts the URL during render when it changes. The one exception is in-progress search text the URL already reflects: "gold " stays "gold " even though the URL says `q=gold`.
- *One owner for the pending search.* Choosing a category cancels the pending debounced search and pushes a URL that includes the typed text. Otherwise the stale debounce would fire afterwards and replace the new URL with old values.
- *`<form role="search">` instead of `<search>`.* jsdom doesn't recognise `<search>`: React logs an error and Testing Library can't find the landmark. Older browsers and assistive tech don't map it either. contracts/ui-components.md and research.md have been updated to match (my decision), along with the client-component filters and the static-shell change in R1.
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

**Decision** (mine): keep the first occurrence of an id, drop later ones, and warn in dev. Cart lines are keyed by product id, so two products sharing one would collide in the cart.

**Detail worth recording**: deduplication happens *after* schema validation. If it ran first, an invalid item could claim an id and cause a later valid item with that id to be dropped too. A separate test pins this ordering. It passed before the fix too, and is there to stop a regression to dedupe-first.

**Test-first**: the duplicate test failed before the change (both items came through) and passes after.

---

## 2026-10-26 — Image hostname check (validation hazard)

The product schema restricts image URLs to `fakestoreapi.com`, so a spoofed or compromised API response
can't point `next/image` at an arbitrary host.

The hazard: `z.url({ hostname })` takes a RegExp and doesn't anchor it. An unanchored `/fakestoreapi\.com/`
would match anywhere in the hostname, so `https://fakestoreapi.com.evil.example/x.jpg` would pass, and the
"allowlist" would really be a substring search. Checked by running the unanchored pattern against the
look-alike host (accepted) and the anchored one (rejected).

The schema has been anchored since its first commit (`00744b6`), and the rule now lives in
`src/lib/image-url.ts`:

```ts
export const ImageUrlSchema = z.url({ protocol: /^https$/, hostname: /^fakestoreapi\.com$/ });
```

A test for the look-alike host (`api-product.test.ts`) keeps it that way.

**Correction (27 Oct)**: this entry was first titled "Human Audit" and showed a "Before" snippet presented as a
bug that was caught and fixed. No commit ever contained that code, so it has been removed, and the entry now describes what happened: a hazard,
identified and pinned with a test. The previous wording is in git history.

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
- ~~Duplicate product ids~~ Decided: keep the first valid item per id and drop later ones with a dev warning, because cart lines are keyed by id. Now in the spec's edge-case list.
