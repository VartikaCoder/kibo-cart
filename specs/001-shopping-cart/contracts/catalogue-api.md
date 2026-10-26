# Contract: Catalogue source (consumed)

**Direction**: inbound, untrusted. **Owner**: `src/features/catalog/api/`. **Requirements**: FR-001, FR-002, FR-013.

## Request

`GET https://fakestoreapi.com/products`, server-side only, timeout 5000 ms (`AbortSignal.timeout`). No headers, no credentials.

## Expected response

`200`, `application/json`, an array of:

```json
{
  "id": 1,
  "title": "Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops",
  "price": 109.95,
  "description": "Your perfect pack for everyday use…",
  "category": "men's clothing",
  "image": "https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg",
  "rating": { "rate": 3.9, "count": 120 }
}
```

Field rules: [data-model.md §1](../data-model.md#1-apiproduct-external-untrusted). There is **no inventory field**.
Do not add one.

## Handling matrix

| Condition | Result | `source` |
|---|---|---|
| 200 + array, ≥ 1 valid item | valid items mapped to `Product`, invalid items dropped (dev warn) | `live` |
| 200 + array, 0 valid items | snapshot path | `snapshot` |
| non-2xx / network error / timeout / invalid JSON / non-array | snapshot path | `snapshot` |
| snapshot path and snapshot yields 0 valid items | throw `CatalogueUnavailableError` → `error.tsx` | — |
| `CATALOGUE_SOURCE=fixture` / `fixture-large` (test/E2E only) | local fixture, same validation | `fixture` |
| `CATALOGUE_SOURCE=fixture-broken` (test/E2E only) | simulates live + snapshot both invalid → `CatalogueUnavailableError` | — |

## Public surface (`features/catalog/index.ts`)

```ts
type CatalogueSource = 'live' | 'snapshot' | 'fixture'
interface Catalogue { source: CatalogueSource; products: Product[]; categories: string[] }

fetchCatalogue(): Promise<Catalogue>          // uncached; unit-tested with MSW
getCatalogue(): Promise<Catalogue>            // 'use cache' + cacheTag('catalogue') + conditional cacheLife
refreshCatalogue(): Promise<void>             // Server Action: updateTag('catalogue')
class CatalogueUnavailableError extends Error
```

## MSW scenarios (required tests)

valid list · one invalid item among valid ones · all invalid · empty array · 500 · 403 · timeout · non-JSON body ·
image host not `fakestoreapi.com` · negative / `NaN`-like price · title containing `<script>` (must render as text).
