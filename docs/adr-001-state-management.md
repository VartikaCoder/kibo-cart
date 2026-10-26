# ADR-001: Client cart state with Zustand over a pure domain

- **Status**: Accepted, 2026-10-26
- **Requirements**: FR-006–FR-012, FR-017, FR-018; research R6–R8

## Context

The cart is the only client-side state that outlives a page. It must persist across reloads, sync across
tabs, survive tampered storage, render without a hydration mismatch, and update count and totals everywhere at
once. Product data is server data and stays out of client state. Filter/sort/page state lives in the URL.

## Decision

1. **The rules live in a pure domain layer** (`features/cart/domain`): add, increment, decrement, set quantity,
   remove, clamp to limits, reconcile prices, migrate, and the selectors for totals. These are plain functions of
   `(cart, …args) → { cart, outcome }`. They use no React, Zustand, Next, or browser APIs, never mutate their
   input, and return the same reference when nothing changed. The max quantity is always an argument.
2. **Zustand 5 is a thin adapter** (`features/cart/store`). Each action looks up the line limit, calls a domain
   function, and stores the result. Components subscribe with narrow selectors, so a product card re-renders only
   when its own line's quantity changes.
3. **The `persist` middleware stores `lines` only**, under the key `kibo-cart`, at version 1. A custom storage
   is the trust boundary. Reads go parse → `migrateCart` → Zod validation. Any failure removes the key and
   yields an *empty cart*, not `null`: with `null`, zustand keeps the current state, so a cart cleared or
   corrupted in another tab would survive here. Writes are skipped when the stored cart wouldn't change. Storage
   errors are caught, and the cart keeps working in memory.
4. **Hydration is manual** (`skipHydration`). The server and the first client render both see an empty,
   `hydrated: false` cart. The client then calls `connectCartPersistence()` after mount, which rehydrates and
   re-clamps saved quantities to current limits. UI shows placeholders until `hydrated` is true.
5. **Cross-tab sync uses the `storage` event**, which fires only in *other* tabs. Each one re-reads storage
   through the same validation. Last write wins; there is no merging. Rehydrating never writes, so nothing
   echoes back.

## Consequences

- Business rules are unit-tested without React or a store. Store tests (jsdom) cover only wiring: one write per
  change, hydration, invalid payloads, and cross-tab sync.
- zustand's `persist` calls `setItem` on *every* `setState`, including UI-only slices (drawer, announcements).
  Write-skipping in the storage keeps that to one actual write per cart change, and serialisation uses a fixed key
  order so equal carts produce equal strings. Splitting UI state into a second, unpersisted store would also
  work, at the cost of two stores to wire.
- The module-level `useCartStore` also exists on the server, but it's never hydrated or mutated there, so
  requests can't leak state into each other. Tests create isolated stores with `createCartStore()`.
- Changing the persisted shape needs a version bump, a `migrateCart` branch, and a fixture test
  (contracts/persisted-cart.md).

## Alternatives considered

- **React Context + `useReducer`**: no persistence or cross-tab support, and every consumer re-renders on every
  change unless the context is split by hand.
- **`useSyncExternalStore` over localStorage directly**: no dependency, but it re-implements subscription,
  versioning, and rehydration that `persist` already provides.
- **Redux Toolkit**: more ceremony than one small slice needs.
- **`BroadcastChannel` for sync**: duplicates the write path. `storage` already fires for localStorage changes.
