# Data Model: Shopping Cart Web Application

**Feature**: `001-shopping-cart` | **Date**: 2026-10-26 | **Research**: [research.md](./research.md)

All money values are `Cents`: a branded integer `number` (`type Cents = number & { readonly __brand: 'Cents' }`).
Totals are **derived** and never stored.

---

## 1. ApiProduct *(external, untrusted)*

The exact shape returned by `GET https://fakestoreapi.com/products`, and nothing more. **No `stock` field.**
Full contract: [contracts/catalogue-api.md](./contracts/catalogue-api.md).

| Field | Type | Validation |
|---|---|---|
| `id` | number | integer, > 0 |
| `title` | string | trimmed, non-empty |
| `price` | number | finite, ≥ 0 (dollars, float) |
| `description` | string | string (may be empty) |
| `category` | string | trimmed, non-empty |
| `image` | string | `https:` URL, host `fakestoreapi.com` |
| `rating.rate` | number | 0 ≤ rate ≤ 5 |
| `rating.count` | number | integer, ≥ 0 |

Unknown extra keys are stripped (Zod default). A failing item is dropped; it never makes the whole response fail.

## 2. Product *(domain, read-only)* — FR-001

Produced once by `toProduct(api: ApiProduct): Product` in `catalog/api`. This is the only place `toCents` is applied to API prices.

| Field | Type | Notes |
|---|---|---|
| `id` | number | |
| `title` | string | rendered as text only (FR-014) |
| `priceCents` | Cents | `toCents(api.price)` |
| `description` | string | |
| `category` | string | |
| `imageUrl` | string | |
| `rating` | `{ rate: number; count: number }` | |

**Catalogue** (`fetchCatalogue` / `getCatalogue` result):
`{ source: 'live' | 'snapshot' | 'fixture'; products: Product[]; categories: string[] }`
- `categories` is derived: the unique, sorted set of `product.category`.
- Invariant: `products.length ≥ 1`. Otherwise `CatalogueUnavailableError` is thrown.

## 3. CatalogueQuery *(URL view state)* — FR-003, FR-004, FR-005

Full contract: [contracts/url-search-params.md](./contracts/url-search-params.md).

| Field | Type | Default | Rule |
|---|---|---|---|
| `category` | string \| null | `null` | must match a known category, otherwise `null` |
| `q` | string | `''` | trimmed, max 100 chars, plain text |
| `sort` | `SortKey` | `'featured'` | `featured`, `price-asc`, `price-desc`, `rating-asc`, `rating-desc`, `name-asc`, `name-desc` |
| `page` | number | `1` | integer ≥ 1, clamped to `[1, totalPages]` after filtering |

**Derived** `CatalogueResult` (from pure `applyCatalogueQuery(products, query, pageSize = 12)`):
`{ items: Product[]; totalItems: number; totalPages: number; page: number /* clamped */ }`.
Ties within a sort are broken by `id` ascending, so the order is stable. Name sort uses `localeCompare` with locale `'en'`.

**Transitions**: changing `category`, `q`, or `sort` resets `page` to 1. Default values are omitted from the
serialised URL (canonical form).

## 4. CartLine *(persisted)* — FR-006, FR-007

| Field | Type | Notes |
|---|---|---|
| `productId` | number | unique within a cart (FR-007) |
| `quantity` | number | integer, 1 ≤ q ≤ line max at the time of the change |
| `unitPriceCents` | Cents | snapshot at add time, updated by reconciliation (FR-018) |
| `title` | string | display snapshot, so the cart renders before the catalogue loads |
| `imageUrl` | string | display snapshot |

**Derived (never stored)**:
- `lineTotalCents = unitPriceCents * quantity`
- `status: 'ok' | 'unavailable'`. `unavailable` when a **live** catalogue is loaded and `productId` is absent from it.

## 5. Cart *(persisted aggregate)* — FR-009, FR-011, FR-012

| Field | Type | Notes |
|---|---|---|
| `version` | `1` | persisted schema version, see [contracts/persisted-cart.md](./contracts/persisted-cart.md) |
| `lines` | CartLine[] | insertion order is preserved and is the display order |

**Derived selectors** (pure, in `cart/domain`):
- `totalQuantity(cart, unavailableIds?)`: sum of quantities of `ok` lines
- `subtotalCents(cart, unavailableIds?)`: sum of `lineTotalCents` of `ok` lines
- `lineQuantity(cart, productId)`: `number` (0 if absent), used by the narrow product-card selector

**Invariants** (enforced by domain functions and asserted in tests):
1. No two lines share a `productId`.
2. Every `quantity` is an integer ≥ 1.
3. Every `unitPriceCents` is an integer ≥ 0.
4. Totals equal the sum of line totals exactly (integer arithmetic).

## 6. Domain operations and outcomes *(pure, `features/cart/domain`)*

Every operation is `(cart, …args) => { cart: Cart; outcome: CartOutcome }` and never mutates its input. When nothing
changes, it returns the **same `cart` reference**, which the store uses to skip `set`. `maxQuantity` is always passed in.

| Operation | Behaviour | Outcomes |
|---|---|---|
| `addItem(cart, snapshot, maxQuantity)` | new line with q = 1, or increment the existing line | `added`, `incremented`, `limit-reached` |
| `increment(cart, productId, maxQuantity)` | q + 1 if q < max | `incremented`, `limit-reached`, `not-found` |
| `decrement(cart, productId)` | q − 1; at q = 1 removes the line | `decremented`, `removed`, `not-found` |
| `setQuantity(cart, productId, raw: string \| number, maxQuantity)` | `raw` is what the user typed: a whole-number string (spaces allowed) or an integer. Anything else, including `''`, → `rejected`, line unchanged. < 1 → 1; > max → max | `updated`, `clamped`, `rejected`, `unchanged`, `not-found` |
| `removeLine(cart, productId)` | removes the line | `removed`, `not-found` |
| `clampToLimits(cart, maxQuantityFor)` | lowers quantities above their line's max; never below 1, never removes | `{ cart; adjustments: {productId, from, to}[] }` |
| `reconcileWithCatalogue(cart, prices: Map<id, Cents>)` | updates changed prices; reports missing ids | `{ cart; priceChanges: {productId, fromCents, toCents}[]; missingIds: number[] }` |
| `migrateCart(persisted: unknown, version: number)` | brings a known version to the current shape, **still unvalidated**; unknown version → `null` | — (the store validates the result with `PersistedCartSchema`, so every version goes through one schema, and Zod stays in `store/`) |

`CartOutcome` is a discriminated union that carries `productId`, `quantity`, `maxQuantity`, and `limitReason` where
relevant. The UI layer turns outcomes into announcement copy; the domain contains no UI strings.

**Line state transitions**:

```text
(absent) --add--> q=1 --add/increment--> q=n (n ≤ max) --increment at max--> q=max [limit-reached]
q=n --decrement--> q=n−1 ... q=1 --decrement--> (absent) [removed]
q=n --setQuantity(x)--> clamp(x, 1, max) | unchanged if x invalid
any --remove--> (absent)
any --live catalogue lacks id--> status=unavailable (derived) --remove--> (absent)
```

## 7. Line limit *(lib, not domain)*

| Entity | Location | Shape |
|---|---|---|
| `MAX_QTY_PER_LINE` | `lib/stock.ts` | `10`, a store policy |
| `InventoryProvider` | `lib/inventory.ts` | `{ getAvailable(productId: number): number }` |
| `simulatedInventory` | `lib/inventory.ts` | **SIMULATED**, deterministic per `productId`, range 3–20 |
| `LineLimit` | `lib/stock.ts` | `{ max: number; reason: 'policy' \| 'availability' }` from `getLineLimit(productId, inventory)` |

## 8. Ephemeral UI state *(store, not persisted)*

| Slice | Type | Purpose |
|---|---|---|
| `hydrated` | boolean | gates count/total rendering (US3-AS4) |
| `announcement` | `{ id: number; message: string } \| null` | the single polite live region (FR-017) |
| `priceNotices` | `Record<productId, { fromCents; toCents }>` | per-line "price changed" notice until dismissed (FR-018) |
| `quantityNotices` | `Record<productId, { from; to; reason }>` | per-line "Reduced to N — …" note after a load lowered a saved quantity; cleared when dismissed or when that line changes |
| `unavailableIds` | `number[]` | result of the last live reconciliation |
| `drawerOpen` | boolean | drawer visibility |
