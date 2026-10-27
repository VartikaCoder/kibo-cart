# Accessibility notes

Target: WCAG 2.2 AA (SC-003). This explains the decisions behind the listing and cart, and where each one is
verified. Component details are in `specs/001-shopping-cart/contracts/ui-components.md`.

## Semantic structure first, ARIA only where nothing native fits

The page is built from native elements:
- `header` and `main` landmarks.
- One `h1` ("Products"); each product card is an `article` with an `h2` title, and the drawer has an `h2`.
- Product, cart, and pagination `ul`s; `nav aria-label="Pagination"`.
- Real `<button>`, `<a href>`, `<select>`, and `<input type="search">` with visible `<label>`s.
- The native modal `<dialog>` for the cart.

Because those elements carry their own roles and keyboard behaviour, most components need no ARIA at all.

Where ARIA is used, it's because no native element expresses the thing:
- **`role="list"` on styled `ul`s.** Safari drops list semantics when `list-style` is removed, which Tailwind
  does. The role restores what the element already means.
- **Live regions** (`role="status"`): there is no native element for "announce this change".
- **State with no native attribute**: `aria-current="page"` (pagination), `aria-expanded` and
  `aria-haspopup="dialog"` (cart button), `aria-busy` (loading skeleton), and `aria-disabled` (see below).
- **Names for icon-only controls**: `IconButton` *requires* a `label` prop, so an unnamed icon button doesn't
  type-check. Names follow the contract: "Increase quantity of {title}", "Remove {title} from cart".
- **Hiding decoration**: icons and the rating stars are `aria-hidden`. The rating's meaning is in text:
  "Rated 3.9 out of 5 (120 reviews)".
- **The Add button's name**: visible "Add to cart" with the title in a visually hidden span, giving "Add {title}
  to cart". It's still a native `<button>` with its own text, not an `aria-label`, so the visible words stay
  inside the accessible name.

## `<form role="search">` rather than `<search>`

The contract first specified the HTML `<search>` element. In practice, jsdom (the component-test environment)
doesn't know `<search>`: React logs "The tag `<search>` is unrecognized", and Testing Library can't find the
`search` landmark. Browsers before 2023, and the assistive tech running on them, don't expose it either.
`<form role="search">` produces the same landmark everywhere. It's the one place where ARIA is used although a
native element exists, chosen for reach and testability, and recorded in the contract (26 Oct — Product
listing).

## Keyboard operability and the focus model

Every interactive element is a native control, so it is reachable by Tab. One global `:focus-visible` rule draws a
2px outline in the `--focus` token (`globals.css`).

Focus never silently drops to `<body>` when the control holding it disappears; it moves deliberately:

| Action | Focus goes to | Why |
|---|---|---|
| "Add to cart" on a card | the new stepper's "+" | the button is replaced by the stepper; "+" is the likely next action |
| "−" at quantity 1 (removes the line) | the card's "Add to cart" | the stepper disappears; Add is what replaced it |
| Remove a line in the drawer | next line's Remove → else previous line's → else the empty-cart message (`tabIndex=-1`) | keeps the user in the list at the same position |
| Open the drawer | inside the dialog (`showModal()`) | the page behind becomes inert, so focus is contained by the browser |
| Close the drawer (button, backdrop, Escape) | the element that opened it (the cart button) | returns the user to where they were |

Each move commits the state change with `flushSync` first, so the target element exists before focus moves.
Closing updates state synchronously on every path. Browsers fire the dialog's `close` event later, and
waiting for it caused a real bug: after Escape, an immediate reopen was lost (26 Oct — Cart UI components).

## One polite live region for cart changes

`CartAnnouncer` renders a single `role="status" aria-live="polite" aria-atomic="true"` region once, in the root
layout, so it exists before any message is sent. Every cart action goes through `cart-commands.ts`, which runs
the store action and passes its outcome to `cartAnnouncement()`. All copy lives in one file
(`announce-copy.ts`). The store holds no UI strings.

Centralising this matters because:
- **One timing behaviour.** Live regions that mount at the same moment as their content are often not
  announced. A region that's always present avoids that.
- **No competing announcements.** Separate regions in each card would race when one action changes several
  things (the line, the count, the subtotal).
- **One place to get the wording right.** For example, "Only 5 of {title} available (demo inventory)", where the
  demo qualifier is a rule, not a style choice.
- **Repeats are re-announced.** Messages are keyed by id, so the same message twice is read twice.
- **Loads are announced too.** Quantities lowered when a saved cart loads are announced ("… reduced from 8 to 5
  — only 5 available (demo inventory).") rather than changed silently.

Separate `role="status"` regions remain for things that aren't cart changes: the listing's result count, the
snapshot notice, and the loading skeleton.

## `aria-disabled`, not `disabled`, on "+" at the limit

A `disabled` button is removed from the tab order and ignores clicks. A keyboard or screen-reader user then
can't reach it, and can't find out *why* they can't add more. At the limit, "+" instead keeps
`aria-disabled="true"`. It stays focusable, it's linked by `aria-describedby` to the visible reason, and a
click announces that reason. The reason distinguishes the real policy ("Limit 10 per order") from simulated
stock ("Only 5 available (demo inventory)"). The same applies to "Add" before the saved cart has loaded, and
to the snapshot notice's Retry while retrying.

## Contrast

Text targets are WCAG AA (4.5:1). Measured ratios recorded for the snapshot notice (26 Oct — Snapshot age in
the fallback notice):

| | Body text | Muted text | Retry |
|---|---|---|---|
| Light | 9.6:1 | 7.1:1 | 6.2:1 |
| Dark | 11.7:1 | 6.7:1 | 9.6:1 |

The design tokens in `globals.css` are annotated as meeting AA for body and muted text in both schemes. Only the
notice's pairs were measured individually. Meaning is never carried by colour alone: limits, notes, and
ratings are all stated in text.

## Automated checks, and what they can't see

- **axe in Playwright** (`e2e/a11y.spec.ts`), tags WCAG 2.0/2.1/2.2 A and AA, on the listing and with the cart
  drawer open on a line at its limit, so the limit text is in scope. **Zero violations**, from the first run.
- **Lighthouse accessibility: 100** on mobile in all six runs (deployed and local; see
  `docs/performance-notes.md`).
- **Keyboard flow** (`e2e/keyboard.spec.ts`): add and adjust by keyboard only, open the cart, 15 Tabs never
  leave the modal, Escape returns focus to the cart button.
- **Component tests** query by role and accessible name (`getByRole`), so a lost name or role fails a test.

Automated tools check structure, not experience. axe can't tell whether:
- the focus order makes sense, or focus lands somewhere useful after an action (covered by the focus tests above);
- an announcement is timely, not too chatty, and worded clearly;
- alternative text is accurate, or the visible label is clear;
- the experience works with an actual screen reader;
- anything is comprehensible, for cognitive accessibility.

## Responsive and target size

Checked against production builds at 375, 768, and 1280 px, with the live catalogue and with the snapshot
notice showing:
- no horizontal scroll at any width;
- **no interactive target under 24 × 24 px** (WCAG 2.2 SC 2.5.8); the controls and steppers are 44 px;
- the filter controls stay inside the viewport and work;
- pagination fits and navigates;
- the drawer is full-width on mobile, and closes by tap and by Escape.

Screenshots: `docs/images/responsive-{live,snapshot}-{listing,drawer,pagination}-{375,768,1280}.png`.

## Trade-offs made under time pressure

- **No `@testing-library/user-event`.** It was declined as a dependency, so component tests use RTL's
  `fireEvent`. That doesn't simulate real keyboard sequences, focus movement between elements, or pointer
  events. Realistic keyboard and pointer interaction is verified in Playwright instead, in a real browser. That
  catches more of what matters, but runs later and more slowly than a component test would.
- **jsdom's `<dialog>` is a stand-in.** jsdom has no `showModal()`, so the test setup provides one. Real modal
  behaviour (inert background, focus containment) is only verified in Playwright.
- **No manual screen-reader pass is recorded.** VoiceOver and NVDA behaviour is inferred from roles, names, and
  live-region semantics, not observed.
- **Two controls share a name at quantity 1.** "−" and the trash button are both "Remove {title} from cart", as
  the contract specifies. Both do the same thing, but a screen-reader user hears the same name twice in one line.
- **Visible spacing in "Add to cart"** (fixed 27 Oct). The visually hidden title split the label into two flex
  items, so `Button`'s gap showed as an 8 px space. The label is now one element, so the gap is one ordinary
  space (3.4 px), measured in a real browser. A component test guards the accessible name, but jsdom can't
  measure layout, so nothing in CI checks the spacing itself.
