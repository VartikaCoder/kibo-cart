# Quickstart & Validation Guide: Shopping Cart

**Feature**: `001-shopping-cart` | Use this guide to prove the implemented feature works end to end. Steps
for parts that were not built are marked **Not implemented**.
Details live in [data-model.md](./data-model.md) and [contracts/](./contracts/); this guide does not repeat them.

## Prerequisites

- Node.js ≥ 20.9 (developed on 24.x), npm
- Playwright browsers: `npx playwright install --with-deps chromium`

## Setup

```bash
npm ci
npm run dev                                   # http://localhost:3000, live fakestoreapi
CATALOGUE_SOURCE=fixture npm run dev          # deterministic local fixture
```

`CATALOGUE_SOURCE=fixture-large` (500 generated products) and `fixture-broken` were planned and are **not
implemented**: any value other than `fixture` is a startup error. The large-catalogue and error-state paths are
covered by unit and component tests instead (contracts/catalogue-api.md).

## Automated gates (all must pass)

```bash
npm run lint
npm run typecheck
npm run test:cov    # thresholds: global ≥ 80%, src/features/cart/domain ≥ 90% lines + branches (SC-006)
npm run build
npm run e2e         # builds and serves with CATALOGUE_SOURCE=fixture; includes axe checks (SC-003)
```

Bundle analysis uses Next's built-in `next analyze`; findings are in `docs/performance-notes.md`.

## Manual validation scenarios

Each step names the acceptance scenario it proves. Use only the keyboard unless a step says otherwise (SC-001).

### US1: Browse and find (fixture mode)

1. Open `/`. Cards show image, title, price (`$x.xx`), category, and rating text (US1-AS1).
2. Throttle the network to "Slow 4G" and reload. The skeleton grid occupies the same space as the cards, and
   Lighthouse/DevTools shows CLS ≈ 0 (US1-AS2).
3. Choose a category, type `bag`, and pick "Price: high to low". The URL becomes, for example,
   `/?category=men%27s+clothing&q=bag&sort=price-desc`. Copy it into a new tab and get the same view (US1-AS5).
4. Search `zzzz`. The empty state says nothing matched, with "Clear filters". Activating it returns to `/` (US1-AS4).
5. Search `<script>"%&.*`. No crash, it renders as literal text, and the empty state shows.
6. With `fixture-large` (**not implemented**; the 500-product case is covered by
   `apply-catalogue-query.test.ts`), go to page 3 and then press Back. You are on page 2 (US1-AS6). Visit `/?page=9999`:
   it clamps to the last page. Visit `/?sort=bogus&category=nope`: defaults apply.
7. Error state: stop the network (`CATALOGUE_SOURCE=fixture-broken` is **not implemented**) with an invalid snapshot → message and
   **Retry** (US1-AS3). With a live source failing and a valid snapshot → the "saved copy" notice and Retry.

### US2: Build a cart

1. Tab to "Add {title} to cart" and press Enter. The badge reads 1, and the screen reader hears "… added to cart" (US2-AS1, AS6).
2. Activate add/increase again. Still one line, with quantity 2 (US2-AS2).
3. Decrease to 1. The control is now "Remove {title} from cart". Activating it removes the line (US2-AS3).
4. Increase to the limit. A policy item stops at 10 ("Limit 10 per order"). A low-availability item stops at its
   simulated max ("Only N available (demo inventory)"). The button stays focusable, and the reason is announced (US2-AS4).
5. Type `0`, `-3`, `2.5`, `abc`, `99` into the quantity input and press Enter each time. Values clamp to 1/max, or
   revert, with announcements.
6. Click "Increase" 15 times quickly with the mouse. The final quantity equals min(1 + 15, max): no lost or doubled updates.
7. Check the subtotal against a hand calculation in cents (US2-AS5).
8. Open the drawer. Tab stays inside it, Esc closes it, and focus returns to the cart button. Removing a middle
   line moves focus to the next line's Remove button.

### US3: Persistence and tabs

1. Add items and reload. The same lines and quantities appear, with no flash of "0" in the badge and no hydration
   warning in the console (US3-AS1, AS4).
2. Open a second tab and change a quantity in tab A. Tab B updates within 1 s, with no reload (US3-AS2, SC-007).
3. In DevTools set `localStorage['kibo-cart']` to `{"state":{"lines":[{"productId":"x"}]},"version":1}`, then to
   `not json`, then to `{"state":{"lines":[]},"version":99}`, reloading after each. Each time the cart is empty, a
   dev warning is logged, and nothing crashes (US3-AS3).

### US4: Price integrity

> **Not implemented** (deliberately scoped out, FR-018); see the README, [What I'd do with more time](../../README.md#live-price-reconciliation-and-no-longer-available-lines-fr-018).
> The steps below describe the intended behaviour and will not pass today.

1. In live or fixture mode, add an item, then edit `unitPriceCents` in localStorage to a different value and reload.
   The line shows the current price plus a "Price changed from $a to $b" notice, and the change is announced (US4-AS1).
2. Edit a `productId` to one that doesn't exist (e.g. `99999`) with valid other fields. The line shows "No longer
   available", is excluded from the subtotal, and can be removed.
3. In snapshot mode, repeat step 1. **No** reconciliation happens, because a snapshot is not authoritative.

### Non-functional

- **Accessibility**: `npm run e2e` axe specs report 0 violations on the listing and the open drawer (SC-003).
  axe on the empty and error states is **not implemented** (it needed the unbuilt fixture modes). Manually check VoiceOver on macOS Safari for steps US2-1 to 4.
- **Responsive**: check 360px, 768px, and 1280px widths. There is no horizontal scroll, and the drawer is full-width on mobile (FR-015).
- **Re-render isolation**: open the React DevTools Profiler, increment one cart line, and only that card's
  `AddToCartControl` and the cart UI commit (SC-005). The recorded capture is `docs/images/profiler-ranked-add-to-cart.png`.
- **Lighthouse (mobile)** on the deployed URL: Performance and Accessibility ≥ 90 (SC-004).
- **Security headers**: `curl -I http://localhost:3000/` shows `Content-Security-Policy`, `X-Content-Type-Options`,
  `Referrer-Policy`, and `Permissions-Policy`. `grep -r dangerouslySetInnerHTML src` returns nothing.
