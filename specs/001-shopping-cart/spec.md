# Feature Specification: Shopping Cart Web Application

**Feature Branch**: `001-shopping-cart`
**Created**: 2026-10-26
**Status**: Draft
**Input**: Senior UI Engineer assignment — product listing, cart with persistence, accessible and responsive UI, tested and documented.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse and find products (Priority: P1)

A shopper opens the store, sees the products, and narrows them down by category, search term, and sort order
to find something they want.

**Why this priority**: Nothing else is usable without a working catalogue.

**Independent Test**: With the cart feature absent, a shopper can load the listing, filter, search, sort,
and paginate, and every view is shareable by URL.

**Acceptance Scenarios**:

1. **Given** the catalogue loads successfully, **When** the shopper opens the store, **Then** each product shows its image, title, price, category, and rating.
2. **Given** products are loading, **When** the page renders, **Then** a loading state is shown that does not shift layout when content arrives.
3. **Given** the product source fails, **When** the page renders, **Then** an error message and a retry action are shown.
4. **Given** a filter/search combination with no matches, **When** applied, **Then** an empty state explains that nothing matched and offers to clear filters.
5. **Given** the shopper selects a category, types a search term, and picks a sort, **When** they reload or share the URL, **Then** the same view is restored.
6. **Given** more products than fit on one page, **When** the shopper changes page, **Then** results paginate and the browser back button returns to the previous page.

---

### User Story 2 — Build a cart (Priority: P1)

A shopper adds products to a cart, changes quantities, removes items, and sees the cart count and totals update everywhere they appear.

**Why this priority**: The core purpose of the application.

**Independent Test**: From the listing, a shopper can add items, adjust quantities, remove items, and see correct totals.

**Acceptance Scenarios**:

1. **Given** a product not in the cart, **When** the shopper adds it, **Then** it appears with quantity 1 and the cart count updates.
2. **Given** a product already in the cart, **When** the shopper adds it again, **Then** its quantity increases instead of a duplicate line appearing.
3. **Given** a line with quantity 1, **When** the shopper decrements, **Then** the line is removed (or the action is clearly a removal).
4. **Given** a line at its maximum quantity, **When** the shopper tries to increase it, **Then** the increase is prevented and the reason is communicated accessibly.
5. **Given** any cart change, **When** it happens, **Then** subtotal, item count, and line totals are correct to the cent.
6. **Given** a cart change, **When** it happens, **Then** it is announced to assistive technology.

---

### User Story 3 — Cart survives reloads and tabs (Priority: P2)

A shopper's cart is still there after a reload, and stays consistent when the store is open in several tabs.

**Why this priority**: Expected behaviour of any real cart; a key source of real-world bugs.

**Independent Test**: Add items, reload — the cart is unchanged. Change the cart in tab A — tab B reflects it.

**Acceptance Scenarios**:

1. **Given** a non-empty cart, **When** the page reloads, **Then** the same items and quantities are shown.
2. **Given** two open tabs, **When** the cart changes in one, **Then** the other updates without a reload.
3. **Given** stored cart data that is corrupted or from an older format, **When** the app loads, **Then** it either migrates the data or starts with an empty cart — it never crashes.
4. **Given** server-rendered pages, **When** the persisted cart loads on the client, **Then** no hydration error or visible flash of wrong data occurs.

---

### User Story 4 — Price integrity (Priority: P3)

A shopper sees current prices even if a price changed after they added the item.

**Why this priority**: Correctness matters in commerce, but the data source rarely changes prices.

**Independent Test**: Seed a cart with an outdated price snapshot; on load with fresh catalogue data, the line shows the current price and a notice.

**Acceptance Scenarios**:

1. **Given** a cart line whose stored price differs from the current catalogue price, **When** catalogue data loads, **Then** the line updates to the current price and the shopper is notified.

---

### Edge Cases

- **Rapid repeated clicks** on add/increment: every click counts exactly once; no lost or doubled updates.
- **Quantity limits**: quantity never goes below 1 on a line or above the line maximum; direct input of invalid values is rejected or clamped.
- **Stock**: the data source has **no inventory data** (products only have id, title, price, description, category, image, rating). Two separate rules apply:
  - *Per-line quantity cap (real business rule)*: a line cannot exceed 10 units. This is a store policy and holds regardless of inventory.
  - *Stock (simulated)*: availability comes from a clearly labelled simulated inventory adapter, not from the API. It is **not** added to the API schema. The UI and docs never present it as real stock data.
  - The effective maximum is `min(perLineCap, simulatedAvailability)`; a real inventory API would replace only the adapter.
- **Invalid API data**: products failing validation are excluded; if none are valid, the error state is shown.
- **Duplicate product ids**: if the catalogue contains more than one valid item with the same id, the first is kept and later ones are dropped (logged in development). Cart lines are keyed by product id, so duplicates would collide. Validation runs first, so an invalid item never claims an id.
- **API unavailable**: error state with retry; a cached or snapshot catalogue may be served instead (decision recorded in README).
- **Product no longer exists**: a cart line whose product disappears from the catalogue is flagged and removable.
- **Corrupted or tampered storage**: discarded safely (see Story 3).
- **Concurrent edits in two tabs**: last write wins. Deliberately not merged (rationale in README).
- **Floating-point money**: all arithmetic in integer cents.
- **Large catalogue**: listing uses URL-driven pagination; behaviour verified against a generated large dataset.
- **Client-side tampering**: the persisted cart lives in localStorage and can be edited by the user. Validation prevents crashes, but it cannot establish trust — a real checkout must re-price and re-check availability server-side. Documented in security notes.
- **Search input**: treated as plain text; special characters do not break filtering or rendering.


## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display each product's image, title, price, category, and rating.
- **FR-002**: The system MUST show distinct loading, empty, and error states for the product listing, with retry on error.
- **FR-003**: Shoppers MUST be able to filter by category, search by title, and sort by price, rating, and name (ascending and descending).
- **FR-004**: Filter, search, sort, and page state MUST be reflected in the URL and restored from it.
- **FR-005**: The listing MUST paginate with a fixed page size (default 12).
- **FR-006**: Shoppers MUST be able to add products to the cart, increment, decrement, and remove lines.
- **FR-007**: Adding an existing product MUST increase its quantity rather than create a duplicate line.
- **FR-008**: Line quantity MUST be clamped between 1 and the line maximum; attempts beyond the limit MUST be communicated.
- **FR-009**: Cart count and totals MUST update immediately wherever they are displayed.
- **FR-010**: All monetary values MUST be stored and computed as integer cents and formatted only for display.
- **FR-011**: The cart MUST persist across reloads and synchronise across open tabs.
- **FR-012**: Persisted cart data MUST be validated and versioned; invalid data MUST NOT crash the app.
- **FR-013**: API responses MUST be validated before use; invalid items MUST be excluded.
- **FR-014**: No API-provided or user-provided content may be rendered as HTML.
- **FR-015**: The UI MUST be responsive across mobile, tablet, and desktop.
- **FR-016**: All functionality MUST be operable by keyboard, with visible focus and managed focus in overlays.
- **FR-017**: Cart changes MUST be announced to assistive technology.
- **FR-018**: Cart lines MUST reflect current catalogue prices and notify the shopper when a price changed.

### Key Entities

- **Product**: id, title, price (cents), description, category, image URL, rating (rate, count). Read-only, from the catalogue.
- **CartLine**: productId, quantity, price snapshot (cents), display snapshot (title, image) so the cart can render before the catalogue loads.
- **Cart**: list of CartLines plus a schema version. Totals are derived, never stored.
- **CatalogueQuery**: category, search term, sort key and direction, page — the URL-serialisable view state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A shopper can go from landing to an updated cart total in under 30 seconds using only the keyboard.
- **SC-002**: Totals are exact to the cent for any combination of supported quantities (verified by tests).
- **SC-003**: Automated accessibility checks report zero violations on the listing and cart views.
- **SC-004**: Lighthouse performance and accessibility scores of 90 or above on the deployed listing page (mobile).
- **SC-005**: Changing one cart line does not re-render unrelated product cards (verified with the React Profiler).
- **SC-006**: The cart domain logic reaches at least 90% line and branch coverage, and the project at least 80% overall.
- **SC-007**: A cart change in one tab appears in another open tab within one second.

## Clarifications

- **Stock source**: the API has no inventory. The product Zod schema mirrors the API exactly, with no invented `stock` field. Simulated availability lives in a separate `InventoryProvider` adapter (`src/lib/inventory.ts`), documented as simulated in the README. The per-line cap of 10 is a genuine policy and is described as such, not as stock.
- **Price on add**: snapshot stored for offline rendering; reconciled against fresh catalogue data (FR-018).
- **Large catalogue strategy**: pagination over virtualisation — shareable URLs, working back button, crawlable pages.
- **Cross-tab conflicts**: last-write-wins; merging is out of scope.
