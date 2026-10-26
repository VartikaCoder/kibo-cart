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
