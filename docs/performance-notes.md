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
