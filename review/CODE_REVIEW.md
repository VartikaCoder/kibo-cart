# Code review: `ProductCard`

Files: [`product-card.bad.tsx`](./product-card.bad.tsx) (before) and [`product-card.good.tsx`](./product-card.good.tsx)
(after). Standalone illustrations, not imported by the app. The snippets below are excerpts from those files.

## Summary

<!-- your summary -->

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

<!-- your explanation -->

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

<!-- your explanation -->

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

<!-- your explanation -->

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

<!-- your explanation -->

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

<!-- your explanation -->

## Behaviour preserved

<!-- your notes -->

## Tooling

<!-- your notes -->
