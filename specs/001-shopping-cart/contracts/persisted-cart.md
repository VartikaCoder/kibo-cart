# Contract: Persisted cart (localStorage)

**Direction**: written and read by this app. Treated as **untrusted** on read (users and extensions can edit it).
**Owner**: `src/features/cart/store/`. **Requirements**: FR-011, FR-012, US3.

## Key and envelope

Key: `kibo-cart`. Value: the zustand `persist` envelope.

```json
{
  "state": {
    "lines": [
      { "productId": 1, "quantity": 2, "unitPriceCents": 10995,
        "title": "Fjallraven - Foldsack No. 1 Backpack…", "imageUrl": "https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg" }
    ]
  },
  "version": 1
}
```

## Validation on read (`PersistedCartSchema`, v1)

- `version`: literal `1`. Other versions go through `migrateCart`. Unknown/future versions → empty cart.
- `lines`: array, ≤ 100 entries.
- Each line: `productId` int > 0. `quantity` int, 1 ≤ q ≤ `MAX_QTY_PER_LINE`. `unitPriceCents` int ≥ 0.
  `title` non-empty string ≤ 300 chars. `imageUrl` an https URL on `fakestoreapi.com`.
- Duplicate `productId`s → payload invalid.
- Quantities are re-clamped to the current line limit after hydration. Simulated availability may be lower than 10.

**Any failure** (JSON parse error, schema failure, unknown version) → remove the key, start empty, and
`console.warn` in development only. Never throw, never render partial garbage.

## Writes

- Exactly one write per state-changing user action. Only `lines` is persisted. Ephemeral slices are not
  (see [data-model.md §8](../data-model.md#8-ephemeral-ui-state-store-not-persisted)).
- A `localStorage` quota or `SecurityError` on write (private mode) is caught. The cart keeps working in memory,
  with a dev warning.

## Cross-tab

- A `storage` event with `key === 'kibo-cart'` → `persist.rehydrate()` (same validation path).
- `newValue === null` → empty cart.
- Conflict policy: **last write wins**. No merging (spec clarification). Target latency: < 1 s (SC-007).

## Versioning rule

Changing the persisted shape requires: bump `version`, add a `migrateCart` branch from the previous version,
add a migration test with a fixture of the old shape, and note it in the README.

## Security note

Validation prevents crashes; it does **not** establish trust. Prices and quantities in storage can be forged,
so a real checkout must re-price and re-check availability server-side (recorded in `docs/security-notes.md`).
