/** Current persisted cart shape. Changing the shape: bump this, add a branch below, add a fixture test. */
export const CART_VERSION = 1;

/**
 * Brings a persisted payload of any known version to the current shape. Returns `null` for unknown or
 * future versions (→ start empty). The result is still untrusted: the caller validates it afterwards,
 * so every version goes through the same schema.
 */
export function migrateCart(persisted: unknown, version: number): unknown {
  switch (version) {
    case 1:
      return persisted;
    default:
      return null;
  }
}
