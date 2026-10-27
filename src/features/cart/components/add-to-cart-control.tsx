'use client';

import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { lineQuantity } from '../domain/selectors';
import type { ProductSnapshot } from '../domain/types';
import { useCartStore } from '../store/cart-store';
import { lineLimitLabel } from './announce-copy';
import { cartCommands } from './cart-commands';

/**
 * On a product card: "Add to cart", which becomes a quantity stepper once the product is in the cart.
 * Subscribes to this product's quantity only (a number), so other cart changes don't re-render it (SC-005).
 */
export function AddToCartControl({ product }: { product: ProductSnapshot }) {
  const { productId, title } = product;
  const hydrated = useCartStore((s) => s.hydrated);
  const quantity = useCartStore((s) => lineQuantity(s, productId));
  const limit = useCartStore((s) => s.lineLimit)(productId);
  const addRef = useRef<HTMLButtonElement>(null);
  const increaseRef = useRef<HTMLButtonElement>(null);

  // The control swaps between a button and a stepper, which would drop focus. Commit synchronously,
  // then move focus to the matching control in the new UI.
  function add() {
    if (!hydrated) return; // an add before the saved cart loads would be overwritten by it
    flushSync(() => cartCommands.add(product));
    increaseRef.current?.focus();
  }

  function decrease() {
    const outcome = flushSync(() => cartCommands.decrement(productId));
    if (outcome.type === 'removed') addRef.current?.focus();
  }

  if (quantity === 0) {
    return (
      <Button ref={addRef} onClick={add} aria-disabled={!hydrated} className="w-full">
        {/* One element, so the flex gap in Button can't split the text around the hidden title ("Add  to cart"). */}
        <span>
          Add<VisuallyHidden> {title}</VisuallyHidden> to cart
        </span>
      </Button>
    );
  }

  return (
    <QuantityStepper
      value={quantity}
      max={limit.max}
      increaseLabel={`Increase quantity of ${title}`}
      decreaseLabel={quantity === 1 ? `Remove ${title} from cart` : `Decrease quantity of ${title}`}
      decreaseRemoves={quantity === 1}
      inputLabel={`Quantity of ${title}`}
      limitMessage={lineLimitLabel(limit)}
      onIncrease={() => cartCommands.increment(productId)}
      onDecrease={decrease}
      onCommit={(raw) => cartCommands.setQuantity(productId, raw)}
      increaseRef={increaseRef}
    />
  );
}
