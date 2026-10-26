# Security notes

Kibo Cart has no backend, accounts, payments, or secrets. Its attack surface is data it doesn't control: the
product API, the URL, and the shopper's own `localStorage`. Each is treated as untrusted and validated at the
boundary (constitution III, CLAUDE.md "Security rules").

## 1. API data is untrusted

- **Zod at the boundary.** Every item from `fakestoreapi.com/products` is checked with `ApiProductSchema`
  (`src/features/catalog/schemas/api-product.ts`) before use, item by item. A bad item is **dropped**, never
  repaired: there is no `.catch()` or `.default()` in that schema, and a mutation test proves adding one fails.
  Unknown keys are stripped, so an invented field (e.g. `stock`) can't reach the app. Duplicate ids keep the first.
- **Image hostname check.** `image` must be `https:` on exactly `fakestoreapi.com`
  (`src/lib/image-url.ts`). The hostname pattern is anchored (`/^fakestoreapi\.com$/`). Zod doesn't anchor it
  for you, and an unanchored pattern would accept `fakestoreapi.com.evil.example`; a test covers that
  look-alike. `next.config` `images.remotePatterns` allows only `https://fakestoreapi.com/img/**`, so the image
  optimizer can't be used to fetch arbitrary URLs either.
- **Same rules for the fallback.** The bundled snapshot and the E2E fixture go through the same schema. The
  snapshot is trusted no more than the API.
- **Server-only.** The fetch runs on the server (`import 'server-only'`); the build fails if a Client Component
  imports it.

## 2. The persisted cart is untrusted input

The cart in `localStorage` can be edited by the shopper, other scripts, or a browser extension.

- Every read goes parse → `migrateCart` (version routing) → `PersistedCartSchema`. That covers integer cents,
  quantity 1–10, non-blank title ≤ 300 chars, the same image-host rule, ≤ 100 lines, and **no duplicate ids**.
- **Any failure discards the whole payload** and starts an empty cart: nothing is repaired. Corrupted data gives
  no safe basis for guessing what the shopper meant (spec edge cases).
- Quantities are re-clamped to current limits after loading, and the shopper is told.
- Cross-tab updates go through the same validation as a page load.

## 3. No HTML from data

- **No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` in `src/`.** The ESLint rule
  `react/no-danger` is an error, so this is enforced, not just observed.
- All API, URL, and storage text renders as React text children, which React escapes.
- URLs are built only with `URLSearchParams`, never by string concatenation.

### XSS via product titles: tested

| Test | What it proves |
|---|---|
| `api-product.test.ts` | a `<script>alert(1)</script>` title passes validation **as text** (it isn't HTML to reject) |
| `fetch-catalogue.test.ts` | the same title survives the whole fetch path unchanged, as a string |
| `product-card.test.tsx` | a `<img src=x onerror=alert(1)>` title renders as the heading's **text**, and the card contains exactly one `<img>` (the product image), not an injected one |
| `product-listing.test.tsx` | a search for `<b>nothing</b>` is echoed in the empty state as literal text |
| `catalogue-query.test.ts`, `serialize-catalogue-query.test.ts` | `%`, `&`, `#`, `<`, `"`, `\`, `.*`, and emoji in the search survive the URL round trip as literal text |
| browser check (dev log, listing) | `/?q=<script>…</script>` renders as text, and no `<script>` element appears in `<main>` |

## 4. HTTP security headers and CSP

Set for every route in `next.config.ts`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self';
  style-src-attr 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none';
  base-uri 'self'; form-action 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
```

Development adds `'unsafe-eval'` (React's dev error stacks) and `style-src 'unsafe-inline'` (Next's dev-tools
overlay). Neither is in production; the E2E test asserts no `unsafe-eval`.

### Verified in the browser, not guessed

I started from the strictest policy (`'self'` everywhere, no `'unsafe-inline'`), drove a production build with
Playwright, and recorded every `securitypolicyviolation`. Each allowance below is there because a violation
proved it necessary:

| Probe | Violations | Conclusion |
|---|---|---|
| strictest | 7 × `script-src-elem` inline, 12 × `style-src-attr` inline. **The page never hydrated.** | Next's bootstrap and streamed RSC payload are inline scripts |
| + `script-src 'unsafe-inline'` | 12 × `style-src-attr`, 1 × `script-src` **eval** (from the Zod chunk) | styles are all *attributes*: 12 `next/image` `fill` positioning styles and 12 rating-bar widths. No inline `<style>` elements |
| + `style-src-attr 'unsafe-inline'`, Zod `jitless` | **0** | final policy |
| development server, final policy | 33 × `style-src-elem` from Next's dev-tools overlay | dev-only `style-src 'unsafe-inline'` → 0 |

- **`img-src` needs no remote host.** The plan expected `https://fakestoreapi.com` and `data:`. Every image is
  served through `/_next/image` on our own origin, and no image violation occurred, so neither is allowed.
- **`style-src-attr` instead of `style-src 'unsafe-inline'`.** The plan allowed all inline styles. Only
  attributes are needed, so inline `<style>` elements stay blocked. Style attributes can't run script.
- **Zod's eval probe.** Zod v4 tests whether it may JIT-compile with `new Function`. It catches the failure, but
  the browser still reports a violation on every saved-cart read. `z.config({ jitless: true })` in the
  client-loaded schema skips the probe; validation is unchanged.
- **No `upgrade-insecure-requests`**, which Next's example includes. Production is HTTPS-only on Vercel, and
  the directive would upgrade the `http://localhost` E2E server's own requests.

### The trade-off: `'unsafe-inline'` scripts vs a nonce

`script-src 'unsafe-inline'` means that if an attacker could inject a `<script>` into our HTML, the CSP wouldn't
stop it. The alternatives:

| Option | Strict `script-src` | Cost |
|---|---|---|
| **Static header with `'unsafe-inline'` (chosen, R10)** | no | none: the prerendered static shell (◐ partial prerender) and CDN caching stay |
| Per-request nonce via `proxy.ts` | yes | Next applies nonces only during dynamic rendering: **every route becomes dynamic**, and Partial Prerendering is incompatible. That loses the static shell and hurts SC-004 |
| Hash-based CSP via SRI (`experimental.sri`) | partly | experimental. It hashes script *files*; the inline RSC payload scripts still need allowing |

Why the chosen risk is acceptable: the injection surface the CSP would backstop barely exists. There's no
`dangerouslySetInnerHTML` (lint-enforced), no user-generated HTML, all data renders as escaped text, and that
is tested with hostile titles (section 3). The remaining directives still matter: `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` (clickjacking), and `connect-src 'self'`,
which stops injected code from sending data anywhere.

**Enforced in CI:** the E2E test `a11y.spec.ts` › "CSP: headers are sent and nothing is blocked…" checks the
headers, then browses, adds to cart, opens the drawer, and reloads (exercising the lazily loaded validation),
failing on any violation. Removing `style-src-attr` makes it fail with 50 violations; I checked.

## 5. Dependencies (`npm audit`, 2026-10-27)

- **`npm audit`: 0 vulnerabilities** (0 critical, high, moderate, low, info) across 679 installed packages.
  **`npm audit --omit=dev`: 0** across the 30 production packages. Nothing to fix, so nothing changed.
- **Install scripts not run.** npm 11 doesn't run dependency install scripts until they're approved. Three are
  pending, and I've deliberately left them unapproved, because lint, unit tests, build, and E2E all pass without
  them:
  - `@parcel/watcher` (`node-gyp rebuild`): its native binary arrives as a prebuilt optional dependency.
  - `msw` (postinstall): copies a browser service worker; we only use `msw/node` in tests.
  - `unrs-resolver` (postinstall): its native binding also arrives as a prebuilt optional dependency.
- Every dependency was added with an explicit decision (CLAUDE.md: no dependency without asking); see the dev log.

## 6. The limits of client-side validation

Validating the saved cart prevents **crashes and nonsense**. It does **not** establish **trust**. Anyone can put
a well-formed cart in `localStorage` with a price of 1 cent, or a quantity the inventory can't cover, and it
will pass every check here, because it's valid data.

So prices, quantities, and availability in the cart are a convenience for the shopper's own browser. **A real
checkout must**:

- re-price every line from the server's catalogue, ignoring `unitPriceCents` from the client;
- re-check availability and per-line limits against real inventory (ours is simulated, `src/lib/inventory.ts`);
- validate the whole request server-side with the same schemas, as the authoritative boundary.

This demo has no checkout, so none of that exists yet. Any checkout added later must start there.
