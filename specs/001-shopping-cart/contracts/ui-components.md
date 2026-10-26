# Contract: UI components and accessibility

**Requirements**: FR-002, FR-006–FR-009, FR-014–FR-017. Every row below is verified by an RTL or Playwright test.

## Public component surface

| Component | Kind | Location | Key props |
|---|---|---|---|
| `ProductGrid` | Server | `catalog/components` | `products: Product[]` |
| `ProductCard` | Server | `catalog/components` | `product: Product`, `priority?: boolean` |
| `ProductGridSkeleton` | Server | `catalog/components` | `count = 12` (same dimensions as cards) |
| `CatalogueFilters` | client leaf | `catalog/components` | `query`, `categories` (search, category, and sort in one GET form) |
| `Pagination` | Server | `catalog/components` | `page`, `totalPages`, `query` (renders `<Link>`s) |
| `EmptyResults` | Server | `catalog/components` | `query` → "Clear filters" link to `/` |
| `SnapshotNotice` | client leaf | `catalog/components` | Retry → `refreshCatalogue()` + `router.refresh()` |
| `AddToCartControl` | client leaf | `cart/components` | `product snapshot`, `limit: LineLimit` |
| `CartButton` | client | `cart/components` | opens drawer; badge from `s => s.totalQuantity` |
| `CartDrawer` | client | `cart/components` | native `<dialog>` |
| `CartLineItem` | client | `cart/components` | `productId` (subscribes to its own line) |
| `CartAnnouncer` | client | `cart/components` | the single polite live region |
| `CartHydrator`, `CatalogueSync` | client, render nothing | `cart/components` | hydration, storage listener, reconciliation |
| `Button`, `IconButton`, `Badge`, `QuantityStepper`, `Drawer`, `VisuallyHidden`, `Skeleton` | primitives | `components/ui` | no product/cart knowledge |

## Accessible names and behaviour

| Element | Accessible name / role | Behaviour |
|---|---|---|
| Add button | "Add {title} to cart" | becomes a `QuantityStepper` once the product is in the cart |
| Increment | "Increase quantity of {title}" | at max: `aria-disabled="true"`, `aria-describedby` → limit text; announces the limit |
| Decrement | "Decrease quantity of {title}", or "Remove {title} from cart" at q = 1 | at q = 1 the visible icon is a trash can |
| Quantity input | label "Quantity of {title}" | commit on blur/Enter; clamp or revert; announces |
| Remove | "Remove {title} from cart" | focus → next line's Remove → previous → empty-state message |
| Cart button | "Cart, {n} items" (after hydration) / "Cart" (before) | `aria-haspopup="dialog"`, `aria-expanded` |
| Drawer | `dialog`, labelled by heading "Your cart" | `showModal()`, Esc closes, focus restored to the cart button |
| Search | `searchbox` labelled "Search products", inside `<form role="search">` | debounced 300 ms (`router.replace`); result count announced politely |
| Category / sort | `<select>` with visible `<label>` | controlled inputs in the same GET form; navigate on change (`router.push`); follow the URL on Back |
| Pagination | `<nav aria-label="Pagination">` | current page `aria-current="page"` |
| Rating | text "Rated {rate} out of 5 ({count} reviews)" | stars are decorative (`aria-hidden`) |

### Notes on the filter controls (decided 2026-10-26)

- **`<form role="search">`, not `<search>`.** It's the same landmark. jsdom doesn't recognise `<search>`: React
  logs an error and Testing Library can't find the role. Browsers before 2023, and the assistive tech running on
  them, don't expose it either. This is the one place the listing uses ARIA where a native element exists.
- **Category and sort are controlled inputs in a client component**, not server-rendered selects. An uncontrolled
  `defaultValue` doesn't follow the URL on Back. Remounting with a `key` drops keyboard focus on every change. The
  component adopts the URL's values during render when the URL changes. The one exception is in-progress search
  text the URL already reflects after trimming.
- **Progressive enhancement is kept.** Without JS the form submits as a plain GET to `/` (an Apply button in
  `<noscript>`). Pagination stays server-rendered `<Link>`s.

## Announcement copy (polite, single region)

| Outcome | Message |
|---|---|
| added | "{title} added to cart. Cart has {n} items." |
| incremented / decremented / updated | "{title} quantity {q}. Subtotal {money}." |
| removed | "{title} removed from cart." |
| limit-reached, policy | "Limit of 10 per order reached for {title}." |
| limit-reached, availability | "Only {max} of {title} available (demo inventory)." |
| clamped | "Quantity for {title} set to {q}." |
| price reconciliation | "Prices updated for {n} items in your cart." |

## Visual and states

- Focus: a visible 2px outline token (`--color-focus`) with ≥ 3:1 contrast on every interactive element.
- Text contrast ≥ 4.5:1 (AA). Price-change and unavailable states use text + icon, not colour alone.
- Listing states: loading (skeleton, no CLS), empty (message + clear filters), error (`error.tsx`: message + Retry
  via `retry()`), snapshot (notice + Retry).
- Responsive grid: 1 column < 640px, 2 columns < 1024px, 3 columns < 1280px, 4 columns otherwise.
  The drawer is full-width on mobile and 28rem from `sm` up.
