# Kibo Cart

A production-grade shopping cart web application built with Next.js (App Router),
TypeScript and Tailwind CSS, using the Fake Store API as its product catalogue.

**Live:** https://kibo-cart.vercel.app
**Repository:** https://github.com/VartikaCoder/kibo-cart

## What I'd do with more time

### Live price reconciliation and "no longer available" lines (FR-018)

Deliberately scoped out. The cart doesn't yet react to catalogue changes after an item is added: there is no
"price changed" note on a line, and no "No longer available" state for products that have disappeared.

- **Why it's low value here:** fakestoreapi often blocks cloud hosts, so the deployed demo usually serves the
  bundled snapshot. Its prices never change, and the design deliberately doesn't reconcile against a snapshot
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
