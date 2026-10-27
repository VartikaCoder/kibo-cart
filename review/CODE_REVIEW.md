# Code Review: ProductCard

Thanks for putting this together. The card works as expected — quantity controls, disabled state at 1, totals, and the reset on product change all behave correctly. Below are four concrete changes plus a note on `memo`. None of them change what the user sees; they mainly remove a class of sync bugs and align money handling with the rest of the codebase.

I've pushed a suggested version in `product-card.good.tsx`. I verified both versions behave identically with a quick RTL test (same text, totals, disabled states, reset, and `onAdd` calls).

## 1. Derived state synced through an effect

### Before
```tsx
const [quantity, setQuantity] = useState(1);
const [lineTotal, setLineTotal] = useState(product.price);

// Keep the line total in sync with the price and quantity.
useEffect(() => {
  setLineTotal(product.price * quantity);
}, [product.price, quantity]);
```

### After
```tsx
const [quantity, setQuantity] = useState(1);

// Derived during render: always consistent with its inputs, no extra render, nothing to keep in sync.
const lineTotalCents = unitPriceCents * quantity;
```

`lineTotal` is completely determined by the price and the quantity, so there’s no reason to store it in state and then keep it updated with an effect. Every time the quantity changes, React first renders with the new quantity but the old total, then the effect runs and fixes it. That means the user can briefly see a mismatched total, and you’re doing extra work to keep two pieces of data in sync that don’t need to be separate.

Calculating the total while rendering removes the state, the effect, and the extra render. The value is always correct on the first paint.

## 2. Resetting state when `product.id` changes

### Before
```tsx
// Start again from 1 when the card is reused for a different product.
useEffect(() => {
  setQuantity(1);
}, [product.id]);
```

### After
```tsx
// Parent: `key` gives each product its own component instance, so state starts fresh.
<ProductCard
  key={product.id}
  productId={product.id}
  title={product.title}
  unitPriceCents={product.priceCents}
  onAdd={handleAdd}
/>
```

When the parent swaps the product, the card first renders the new product with the old quantity and total, then the effect corrects it. It also only resets the state someone remembered to list in the dependency array. React's tool for “this is a different thing now” is identity — a new `key` gives a fresh instance with fresh state, so there's no effect and no intermediate render. Remounting is cheap here.

## 3. Inline handler closing over `quantity` and the whole `product`

### Before
```tsx
interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, quantity: number) => void;
}

<button type="button" onClick={() => setQuantity(quantity + 1)}>+</button>
<button type="button" onClick={() => onAdd(product, quantity)}>
  Add to cart
</button>
```

### After
```tsx
interface ProductCardProps {
  productId: number;
  title: string;
  /** Integer cents. */
  unitPriceCents: number;
  onAdd: (productId: number, quantity: number) => void;
}

<button type="button" onClick={() => setQuantity((q) => q + 1)}>+</button>
<button type="button" onClick={() => onAdd(productId, quantity)}>
  Add to cart
</button>
```

Passing the whole `Product` couples the card to the API shape (including the float price and fields it never uses). The card only needs `productId`, `title`, and `unitPriceCents`; the callback only needs an id and a quantity. Primitive props also compare cheaply, which matters if the card is ever memoized. The `+`/`−` handlers should use the functional form of `setQuantity` so they can't close over a stale value.

## 4. Float money and `.toFixed(2)`

### Before
```tsx
<p className="text-sm text-ink-muted">${product.price.toFixed(2)} each</p>
<p className="font-semibold">Total: ${lineTotal.toFixed(2)}</p>
```

### After
```tsx
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatCents = (cents: number) => usd.format(cents / 100);

<p className="text-sm text-ink-muted">{formatCents(unitPriceCents)} each</p>
<p className="font-semibold">Total: {formatCents(lineTotalCents)}</p>
```

Using `.toFixed(2)` on a float works fine for simple display most of the time, but it hides the real problem. Floating-point numbers aren’t exact, so values like `0.1 + 0.2` don’t add up cleanly, and rounding can go wrong (for example `(1.005).toFixed(2)` becomes `"1.00"`). Once that float gets summed, compared, or sent somewhere else, the errors stick around.

Storing the price in integer cents and formatting with `Intl.NumberFormat` keeps the math exact and handles currency properly (grouping, symbols, negative amounts). The display stays the same, but the underlying value is safer.

## 5. `memo` and the stable `onAdd` contract

### After
```tsx
export const ProductCard = memo(function ProductCard({ productId, title, unitPriceCents, onAdd }: ProductCardProps) {
  // …
});
```

### Parent
```tsx
// Stable: memo(ProductCard) can skip re-renders.
const handleAdd = useCallback((productId: number, quantity: number) => {
  cart.add(productId, quantity);
}, [cart]);

// Not stable: a new function every render, so memo never skips.
<ProductCard key={product.id} /* … */ onAdd={(id, qty) => cart.add(id, qty)} />
```

If the parent passes an inline arrow, `memo` does a props comparison and then re-renders anyway — strictly worse than no memo. If a stable callback isn't realistic, drop the `memo` rather than keep it as decoration.

## Behaviour preserved

Both versions produce the same visible result: same title, unit price, quantity controls (with “−” disabled at 1), line total, and Add to cart behavior. Quantity resets when the product changes. The good version passes the product id instead of the whole product object to `onAdd`.

## Tooling

Issues 1 and 2 are caught by `react-hooks/set-state-in-effect` under the current `eslint-plugin-react-hooks` v7 config. Issues 3 and 4 are not caught by lint. Both files pass lint and typecheck.
