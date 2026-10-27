'use client';

/*
 * CODE REVIEW EXERCISE: the "after" version of review/product-card.bad.tsx. Same behaviour; see
 * review/CODE_REVIEW.md. Standalone illustration: not imported by the app.
 *
 * Parent usage:
 *
 *   // A stable callback: memo(ProductCard) only skips re-renders if this reference doesn't change.
 *   // An inline `onAdd={(id, qty) => …}` here would be a new function every render and defeat memo.
 *   const handleAdd = useCallback((productId: number, quantity: number) => {
 *     cart.add(productId, quantity);
 *   }, [cart]);
 *
 *   // `key` resets the card's local quantity when it shows a different product: React mounts a fresh
 *   // instance instead of reusing state from the previous one. This replaces the reset effect.
 *   <ProductCard
 *     key={product.id}
 *     productId={product.id}
 *     title={product.title}
 *     unitPriceCents={product.priceCents}  // integer cents, converted once at the API boundary
 *     onAdd={handleAdd}
 *   />
 */

import { memo, useState } from 'react';

// In the app this is `formatMoney` from src/lib/money.ts; inlined to keep the exercise standalone.
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatCents = (cents: number) => usd.format(cents / 100);

interface ProductCardProps {
  productId: number;
  title: string;
  /** Integer cents. */
  unitPriceCents: number;
  onAdd: (productId: number, quantity: number) => void;
}

/** Re-renders only when its props change; that holds only if the parent passes a stable `onAdd`. */
export const ProductCard = memo(function ProductCard({ productId, title, unitPriceCents, onAdd }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);

  // Derived during render: always consistent with its inputs, no extra render, nothing to keep in sync.
  const lineTotalCents = unitPriceCents * quantity;

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-sm text-ink-muted">{formatCents(unitPriceCents)} each</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease quantity of ${title}`}
          disabled={quantity <= 1}
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
        >
          −
        </button>
        <span aria-live="polite">{quantity}</span>
        <button
          type="button"
          aria-label={`Increase quantity of ${title}`}
          onClick={() => setQuantity((q) => q + 1)}
        >
          +
        </button>
      </div>

      <p className="font-semibold">Total: {formatCents(lineTotalCents)}</p>

      {/* Inline arrows on DOM elements are fine: a <button> isn't memoised, so a new function costs nothing. */}
      <button type="button" onClick={() => onAdd(productId, quantity)}>
        Add to cart
      </button>
    </article>
  );
});
