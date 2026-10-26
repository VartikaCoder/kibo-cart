'use client';

import Image from 'next/image';
import { IconButton } from '@/components/ui/icon-button';
import { CloseIcon, TrashIcon } from '@/components/ui/icons';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { formatMoney } from '@/lib/money';
import { lineTotalCents } from '../domain/selectors';
import { useCartStore } from '../store/cart-store';
import { lineLimitLabel, quantityReducedNote } from './announce-copy';
import { cartCommands } from './cart-commands';

interface CartLineItemProps {
  productId: number;
  /** Removing the line (Remove, or "−" at quantity 1). The drawer owns it so it can place focus afterwards. */
  onRemove(productId: number): void;
}

/** One cart line. Subscribes to its own line only, so changing another line doesn't re-render it. */
export function CartLineItem({ productId, onRemove }: CartLineItemProps) {
  const line = useCartStore((s) => s.lines.find((l) => l.productId === productId));
  const notice = useCartStore((s) => s.quantityNotices[productId]);
  const limit = useCartStore((s) => s.lineLimit)(productId);
  const dismissNotice = useCartStore((s) => s.dismissQuantityNotice);
  if (!line) return null;

  const { title, quantity } = line;

  return (
    <li className="flex gap-3 border-b border-border px-4 py-4">
      <div className="relative size-16 shrink-0 rounded-md bg-white">
        {/* Decorative: the title is right next to it. */}
        <Image src={line.imageUrl} alt="" fill sizes="64px" className="object-contain p-1" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-medium">{title}</h3>
            <p className="text-sm text-ink-muted">{formatMoney(line.unitPriceCents)} each</p>
          </div>
          <IconButton label={`Remove ${title} from cart`} data-remove-for={productId} onClick={() => onRemove(productId)}>
            <TrashIcon className="size-4" />
          </IconButton>
        </div>

        {notice && (
          <p className="flex items-center justify-between gap-2 rounded-md bg-notice px-3 py-1 text-xs text-notice-ink">
            {quantityReducedNote(notice)}
            <IconButton label={`Dismiss note for ${title}`} onClick={() => dismissNotice(productId)} className="size-8">
              <CloseIcon className="size-3.5" />
            </IconButton>
          </p>
        )}

        <div className="flex items-end justify-between gap-2">
          <QuantityStepper
            value={quantity}
            max={limit.max}
            increaseLabel={`Increase quantity of ${title}`}
            decreaseLabel={quantity === 1 ? `Remove ${title} from cart` : `Decrease quantity of ${title}`}
            decreaseRemoves={quantity === 1}
            inputLabel={`Quantity of ${title}`}
            limitMessage={lineLimitLabel(limit)}
            onIncrease={() => cartCommands.increment(productId)}
            onDecrease={() => (quantity === 1 ? onRemove(productId) : cartCommands.decrement(productId))}
            onCommit={(raw) => cartCommands.setQuantity(productId, raw)}
          />
          <p className="text-sm font-semibold tabular-nums">{formatMoney(lineTotalCents(line))}</p>
        </div>
      </div>
    </li>
  );
}
