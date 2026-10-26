import { expect, type Page } from '@playwright/test';

/**
 * Fixture catalogue (src/features/catalog/api/fixtures/catalogue.json) and its SIMULATED limits
 * (src/lib/inventory.ts): the backpack is capped by the 10-per-order policy, the slim-fit shirt by
 * availability (5).
 */
export const BACKPACK = {
  id: 1,
  title: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops',
  cents: 10995,
  image: 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_t.png',
};
export const TSHIRT = { id: 2, title: 'Mens Casual Premium Slim Fit T-Shirts', cents: 2230, image: 'https://fakestoreapi.com/img/71-3HjGNDUL._AC_SY879._SX._UX._SY._UY_t.png' };
export const SLIM_FIT = { id: 4, title: 'Mens Casual Slim Fit', cents: 1599, image: 'https://fakestoreapi.com/img/71YXzeOuslL._AC_UY879_t.png' };

export const cartButton = (page: Page) => page.getByRole('button', { name: /^Cart/ });
export const cartDialog = (page: Page) => page.getByRole('dialog', { name: 'Your cart' });
export const productCard = (page: Page, title: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

/** The single cart live region. Located by its attributes because, by design, it has no accessible name. */
export const cartAnnouncer = (page: Page) => page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]');

/** Opens the listing and waits until the saved cart has loaded (the cart button shows a count). */
export async function openStore(page: Page, path = '/') {
  await page.goto(path);
  await expect(cartButton(page)).toHaveAccessibleName(/^Cart, \d+ items?$/);
}

/** Seeds a saved cart before the page's scripts run, as if left by an earlier visit. */
export async function seedCart(
  page: Page,
  lines: { id: number; title: string; cents: number; image: string; quantity: number }[],
) {
  const value = JSON.stringify({
    state: {
      lines: lines.map((l) => ({
        productId: l.id,
        quantity: l.quantity,
        unitPriceCents: l.cents,
        title: l.title,
        imageUrl: l.image,
      })),
    },
    version: 1,
  });
  await page.addInitScript((saved) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('kibo-cart', saved);
      sessionStorage.setItem('seeded', '1'); // only on the first load, so reloads see real changes
    }
  }, value);
}
