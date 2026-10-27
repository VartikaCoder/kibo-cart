'use client';

/*
 * CODE REVIEW EXERCISE: the "before" version. Deliberately flawed; see review/CODE_REVIEW.md.
 * Standalone illustration: not imported by the app.
 */

import { useEffect, useState } from 'react';

export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: { rate: number; count: number };
}

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, quantity: number) => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [lineTotal, setLineTotal] = useState(product.price);

  // Keep the line total in sync with the price and quantity.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: the anti-pattern under review
    setLineTotal(product.price * quantity);
  }, [product.price, quantity]);

  // Start again from 1 when the card is reused for a different product.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: the anti-pattern under review
    setQuantity(1);
  }, [product.id]);

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium">{product.title}</h3>
      <p className="text-sm text-ink-muted">${product.price.toFixed(2)} each</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease quantity of ${product.title}`}
          disabled={quantity <= 1}
          onClick={() => setQuantity(quantity - 1)}
        >
          −
        </button>
        <span aria-live="polite">{quantity}</span>
        <button
          type="button"
          aria-label={`Increase quantity of ${product.title}`}
          onClick={() => setQuantity(quantity + 1)}
        >
          +
        </button>
      </div>

      <p className="font-semibold">Total: ${lineTotal.toFixed(2)}</p>

      <button type="button" onClick={() => onAdd(product, quantity)}>
        Add to cart
      </button>
    </article>
  );
}
