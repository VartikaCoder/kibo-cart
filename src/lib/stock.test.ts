import { type InventoryProvider, simulatedInventory } from './inventory';
import { getLineLimit, MAX_QTY_PER_LINE } from './stock';

const inventoryOf = (available: number): InventoryProvider => ({ getAvailable: () => available });

describe('getLineLimit', () => {
  it.each([
    [3, { max: 3, reason: 'availability' }],
    [9, { max: 9, reason: 'availability' }],
    [10, { max: MAX_QTY_PER_LINE, reason: 'policy' }],
    [20, { max: MAX_QTY_PER_LINE, reason: 'policy' }],
    [0, { max: 0, reason: 'availability' }],
    [-4, { max: 0, reason: 'availability' }],
    [4.7, { max: 4, reason: 'availability' }],
  ])('availability %p → %p', (available, expected) => {
    expect(getLineLimit(1, inventoryOf(available))).toEqual(expected);
  });
});

describe('simulatedInventory', () => {
  const ids = Array.from({ length: 500 }, (_, i) => i + 1);

  it('returns an integer from 3 to 20 for every id, the same each time', () => {
    for (const id of ids) {
      const available = simulatedInventory.getAvailable(id);
      expect(Number.isInteger(available) && available >= 3 && available <= 20).toBe(true);
      expect(simulatedInventory.getAvailable(id)).toBe(available);
    }
  });

  it('caps some real catalogue products (ids 1–20) by availability and some by policy, so both paths are exercised', () => {
    const reasons = new Set(ids.slice(0, 20).map((id) => getLineLimit(id, simulatedInventory).reason));
    expect(reasons).toEqual(new Set(['availability', 'policy']));
  });
});
