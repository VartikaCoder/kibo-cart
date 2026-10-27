# Performance notes

## Zod in the client bundle for `/` (2026-10-26)

**Finding.** `zod` was 98.54 KB of the client initial load for `/` (`next analyze`, Client, Initial load only:
394.93 KB total; the route header showed 427.64 KB). That's about 3× all of `src/`.

**Why it was there.** Tracing the import graph (`next analyze export`) showed two client paths:

1. `CatalogueFilters` → `schemas/catalogue-query` → zod. The filter form reused the server's URL parser to
   normalise its own values. That isn't a trust boundary: the server re-validates every URL with Zod.
2. Every cart client component → `cart-store` → `cart-storage` → `persisted-cart-schema` (+ `lib/image-url`)
   → zod. This is the legitimate one: validating the saved cart on rehydrate.

**Options measured** (same tool and filter; KB uncompressed):

| Variant | zod (initial) | Initial total | Validation |
|---|---|---|---|
| Before | 98.54 | 394.93 | unchanged |
| Path 1 fixed (Zod-free filter rules) | 98.48 | 394.37 | unchanged; parity test vs the Zod parser |
| + B: `zod/mini` for the cart schema | 58.89 | 354.79 | same rules, same tests pass |
| + A: lazy `import()` of the cart schema | see below | see below | unchanged (classic Zod, same tests) |
| C: hand-written validator | not prototyped | — | weakest: re-implements rules outside the stack's validator |

**A, measured in a real browser** (production build, `next start`):

- No saved cart: the page loads 9 JS files (157.4 KB transferred, 508.2 KB decoded) and **never requests the
  Zod chunk**. `getItem` returns early before the import.
- Saved cart: the Zod chunk (30.8 KB transferred, 105.8 KB decoded) is fetched after hydration (started at
  46 ms, after DOMContentLoaded at 44 ms), and the cart restored normally.

**Re-checked on the deployed site** (https://kibo-cart.vercel.app, 2026-10-27, Chrome DevTools Network, JS
filter):

| | JS files | Transferred | Resources (decoded) | Screenshot |
|---|---|---|---|---|
| No saved cart | 9 | 161 kB | 509 kB | [no cart](images/zod-chunk-deployed-no-cart.webp) |
| Saved cart (1 item) | 10 | 193 kB | 615 kB | [saved cart](images/zod-chunk-deployed-saved-cart.webp) |

- The only extra file is `3fto7xbd0i34p.js`, 32.3 kB transferred, and it accounts for the whole difference
  (193 − 161 = 32 kB; 615 − 509 = 106 kB decoded, matching the 105.8 KB measured locally). The other nine files
  are the same in both captures, within 0.2 kB.
- Its initiator is the Turbopack runtime chunk, not the HTML: it's loaded on demand, not in the initial set.
- Searching its response for "zod" finds 520 matches ([contents](images/zod-chunk-deployed-contents.webp)).
- "Disable cache" was off for the first capture and on for the second; both show every file fetched over the
  network, with sizes in kB rather than "(memory cache)".

**Why the browser, not the analyzer, is the "after" measurement.** The analyzer's Initial-load view still
attributes Zod (98.48 KB) to the initial load for variant A. Its own exported module graph (`next analyze
export`) disagrees: every Zod part sits in a client group of kind `async`, triggered by
`persisted-cart-schema.ts`. The browser disagrees too: no Zod chunk is requested without a saved cart. So I
measured in the browser. A network waterfall shows what users actually download; the analyzer view is a
static estimate.

**Decision: A** (path 1 fix + lazy-loaded cart schema).
- Validation is untouched: same classic Zod schema, same tests, still runs on every read.
- First visits and empty carts download no Zod at all.
- Rehydration already happens after mount behind placeholders, so making it async changes nothing the user sees.
- The write-skip check no longer needs the schema. It compares canonical JSON; anything malformed is simply
  overwritten, and validation happens on read.

B was not layered on top: see the README, "What I'd do with more time". C was rejected: it saves the least over
A and moves away from "validate with Zod at every trust boundary".

**Regression guard.** `src/test/client-bundle-guard.test.ts` imports every `'use client'` module with `zod`
made to throw, so a static Zod import anywhere in a client module's graph fails CI. The dynamic `import()` of
the cart schema is deliberately allowed. Checked by reintroducing both original imports: each failed the guard.

## Lighthouse, mobile preset (2026-10-27) — SC-004

Lighthouse 13.5.0, default mobile preset (emulated Moto G Power, simulated throttling), 3 runs per target;
the performance score lists all three, and the other columns come from the median-score run. Reports for the median runs: `docs/lighthouse/mobile-{deployed,local}-median.{html,json}`.

| Target | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Deployed (https://kibo-cart.vercel.app) | **98** (94, 98, 98) | 100 | 100 | 100 | 2.4 s | 0 | 30 ms |
| Local production build (`next start`) | **93** (93, 95, 91) | 100 | 100 | 100 | 3.2 s | 0 | 30 ms |

- **SC-004 (performance and accessibility ≥ 90 on mobile) is met** on both targets, in every run.
- **LCP element:** the first product card's image (the Fjallraven backpack, `<img … fetchpriority="high"
  loading="eager">`), in all six runs.
- **Local vs deployed:** local scores lower even though its observed LCP phases are tiny (time to first byte
  5 ms vs 103 ms deployed). The score comes from Lighthouse's *simulated* throttling, which models connections.
  `next start` serves HTTP/1.1 on localhost, while Vercel serves HTTP/2 from a CDN; that is the likely cause of
  the gap. Not isolated further. Deployed LCP (2.4 s) is inside the 2.5 s "good" threshold; local (3.2 s) isn't.
- **Remaining opportunities (both targets, not acted on):** image delivery (~123 KiB estimated savings), unused
  JavaScript (~26 KiB), legacy JavaScript (~14 KiB), and render-blocking requests (~120 ms).
  These were measured and deliberately not acted on: with deployed performance at 98 and LCP at 2.4 s (within
  "good"), the remaining gains didn't justify the work. Most of the image saving is ours to fix, not
  third-party: the cards' `sizes` hint requests full-width images that `object-contain` then shows narrower for
  portrait products (e.g. 370 × 640 served, 191 × 330 shown), and the unused JavaScript is 36% of one
  first-party chunk.
- **`sizes` over-fetch: identified, fix known, not applied in this submission.** The fix is a narrower `sizes`
  value on the product cards (`CARD_IMAGE_SIZES` in `product-card.tsx`), followed by a re-measure for a
  before/after here. With LCP already inside "good", I chose to leave it rather than make an unmeasured change
  late. It's listed in the README under "What I'd do with more time".

## Why the deployed site serves the snapshot

On Vercel, the live fetch to fakestoreapi fails and the app serves the bundled snapshot. To rule out a regional
block, I changed the Vercel function region from the default to Mumbai and redeployed. The live fetch still failed,
and the snapshot was still served, so the failure isn't specific to the default region. I've since reverted to the
default region, which is what the Lighthouse numbers above were measured against.

## What re-renders when the cart changes (SC-005)

**Measured.** Clicking "Add to cart" on one product card re-rendered no `ProductCard` and no part of the
product grid: the page tree (`OuterLayoutRouter` and everything under it) is greyed out in the flame graph. Only
the clicked card's `AddToCartControl` rendered; the other cards' controls didn't. That is what SC-005 claims.

How it was captured: React DevTools Profiler, an empty cart, the drawer closed, one click on a card's
"Add to cart". This was a development build (`HotReload` and the dev overlay's error boundary appear in the
tree), so the durations are inflated and a production build wouldn't include those wrappers; the shape of the
commit is what matters. Captures: [ranked](images/profiler-ranked-add-to-cart.png),
[flame graph](images/profiler-flamegraph-add-to-cart.png).

- The commit was caused by exactly four subscribers: `CartButton`, `AddToCartControl`, `CartDrawer`,
  `CartAnnouncer`.
- **The drawer rendered although it was closed.** `CartDrawer` stays mounted, and the native `<dialog>` only
  controls whether it's shown, so its subtree (`Drawer`, `CartTotals`, the line's `QuantityStepper`) renders on
  every cart change, visible or not. That's a real, small cost: about 1.3 ms of the commit here (`Drawer` 0.8 ms,
  `CartDrawer` 0.5 ms, self time).
- `CartLineItem key="1"` (1.7 ms) is a **mount**, not a re-render: the cart was empty before the click. It
  doesn't tell you what re-rendering an existing line costs.
- Render time for the whole commit: 9 ms, layout effects 0.6 ms.
- The recording has two commits; only the first was examined. The second was not.

**Why.** Product cards are Server Components; the only client code per card is `AddToCartControl`. Every
cart component subscribes to the Zustand store with a narrow selector that returns a primitive or a stable
value (`lineQuantity(s, productId)`, `s.drawerOpen`, `totalQuantity(...)`; the drawer's list of product ids uses
`useShallow`). Zustand re-renders a subscriber only when its selected value changes, so a change to product 1's
line is invisible to every other card's control. No `memo` anywhere: nothing measured called for it
(Constitution VI).

**Reasoned from the code, not measured.** Adding a *new* product changes the drawer's id list, so `CartDrawer`
re-renders and, with no `memo`, so does every `CartLineItem`. Changing the quantity of an existing line doesn't
change that list, so only that line's `CartLineItem` re-renders. Carts are small, so re-rendering every line on
an add should cost little, but I haven't measured a multi-line cart, and I won't add a `memo` until a
measurement shows a need for it. None of this is checked by an automated test; an RTL render-count test was
planned and not built (research R12).
