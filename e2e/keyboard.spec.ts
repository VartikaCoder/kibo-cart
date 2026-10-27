import { expect, type Page, test } from '@playwright/test';
import { BACKPACK, cartAnnouncer, cartButton, cartDialog, openStore } from './support';

/** Presses Tab (or Shift+Tab) until the focused element matches, failing after `limit` presses. */
async function tabTo(page: Page, matches: (name: string) => boolean, { back = false, limit = 40 } = {}) {
  const visited: string[] = [];
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    const name = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? '',
    );
    if (matches(name)) return name;
    visited.push(name);
  }
  throw new Error(`Focus never reached the expected element. Visited: ${JSON.stringify(visited)}`);
}

test('keyboard only: add, adjust, open the cart, focus stays in the drawer, Escape restores focus (FR-016)', async ({
  page,
}) => {
  await openStore(page);

  // Add the first product and increase it, without the mouse.
  const added = await tabTo(page, (name) => /^Add .+ to cart$/.test(name));
  await page.keyboard.press('Enter');
  const title = added.replace(/^Add (.+) to cart$/, '$1');
  expect(title).toBe(BACKPACK.title); // first in catalogue order, so the subtotal below is known
  await expect(page.getByRole('button', { name: `Increase quantity of ${title}` })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cartButton(page)).toHaveAccessibleName('Cart, 2 items');

  // The updated total (SC-001): 2 × $109.95 = $219.90, announced and shown in the drawer.
  await expect(cartAnnouncer(page)).toHaveText(`${title} quantity 2. Subtotal $219.90.`);

  // Back to the cart button and open the drawer.
  await tabTo(page, (name) => /^Cart, \d+ items?$/.test(name), { back: true });
  await page.keyboard.press('Enter');
  const drawer = cartDialog(page);
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Subtotal').locator('xpath=following-sibling::dd[1]')).toHaveText('$219.90');

  // Focus is contained: tabbing well past the drawer's controls never lands on the page behind it.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    const inPageBehind = await page.evaluate(() => {
      const active = document.activeElement;
      return active !== null && active !== document.body && !active.closest('dialog');
    });
    expect(inPageBehind, `Tab ${i + 1} moved focus behind the drawer`).toBe(false);
  }

  // Escape closes it and returns focus to the cart button.
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(cartButton(page)).toBeFocused();
  await expect(cartButton(page)).toHaveAttribute('aria-expanded', 'false');
});
