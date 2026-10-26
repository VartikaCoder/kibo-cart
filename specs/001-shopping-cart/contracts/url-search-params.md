# Contract: Listing URL (exposed)

**Direction**: inbound from the user (shareable links), untrusted. **Owner**: `src/features/catalog/schemas/catalogue-query.ts`.
**Requirements**: FR-003, FR-004, FR-005, US1-AS5, US1-AS6.

## Route

`/` (the product listing). All view state is in the query string. Nothing else stores it.

| Param | Values | Default (omitted from URL) | Invalid input → |
|---|---|---|---|
| `category` | an exact category name from the catalogue | none (all) | ignored (all) |
| `q` | free text, ≤ 100 chars after trim | `''` | truncated to 100; empty → omitted |
| `sort` | `featured` · `price-asc` · `price-desc` · `rating-asc` · `rating-desc` · `name-asc` · `name-desc` | `featured` | `featured` |
| `page` | integer ≥ 1 | `1` | `1`; beyond last page → last page |

Repeated params (e.g. `?sort=a&sort=b`) use the first value.

## Functions (pure, unit-tested)

```ts
parseCatalogueQuery(params: Record<string, string | string[] | undefined>, categories: string[]): CatalogueQuery  // never throws
serializeCatalogueQuery(query: CatalogueQuery): string   // URLSearchParams; canonical order category,q,sort,page; defaults omitted
withQuery(current: CatalogueQuery, patch: Partial<CatalogueQuery>): CatalogueQuery  // resets page to 1 unless patch sets page
```

## Guarantees

- Round trip: `parse(serialize(q)) ≡ q` for every valid `q` (property-style test over generated queries).
- URLs are built only with `URLSearchParams`, never string concatenation.
- Special characters (`%`, `&`, `#`, `<`, `"`, `\`, `.*`, emoji) survive the round trip and filter as literal text.
- Navigation: search uses `router.replace` (typing must not flood history). Category/sort/page changes push
  history entries so Back restores the previous view (US1-AS6).
