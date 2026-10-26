import { expect, test } from '@playwright/test';
import {
  BACKPACK,
  cartAnnouncer,
  cartButton,
  cartDialog,
  openStore,
  productCard,
  seedCart,
  SLIM_FIT,
  TSHIRT,
} from './support';

test('core flow: browse → add → adjust quantity → totals → reload keeps the cart (US1, US2, US3)', async ({ page }) => {
  await openStore(page);

  // Browse: filter the listing through the URL-driven controls.
  await page.getByRole('combobox', { name: 'Category' }).selectOption("men's clothing");
  await expect(page).toHaveURL(/category=men%27s\+clothing/);

  // Add two products; adjust one on its card.
  const tshirt = productCard(page, TSHIRT.title);
  await tshirt.getByRole('button', { name: `Add ${TSHIRT.title} to cart` }).click();
  await tshirt.getByRole('button', { name: `Increase quantity of ${TSHIRT.title}` }).click();
  await productCard(page, BACKPACK.title).getByRole('button', { name: `Add ${BACKPACK.title} to cart` }).click();
  await expect(cartButton(page)).toHaveAccessibleName('Cart, 3 items');

  // Adjust the other by typing in the drawer.
  await cartButton(page).click();
  const drawer = cartDialog(page);
  const quantity = drawer.getByRole('textbox', { name: `Quantity of ${BACKPACK.title}` });
  await quantity.fill('3');
  await quantity.press('Enter');

  // 2 × $22.30 + 3 × $109.95 = $374.45, all in integer cents.
  await expect(cartAnnouncer(page)).toHaveText(`${BACKPACK.title} quantity 3. Subtotal $374.45.`);
  await expect(drawer.getByText('Subtotal').locator('xpath=following-sibling::dd[1]')).toHaveText('$374.45');
  await expect(cartButton(page)).toHaveAccessibleName('Cart, 5 items');

  // Reload: the same lines and totals come back.
  await page.reload();
  await expect(cartButton(page)).toHaveAccessibleName('Cart, 5 items');
  await cartButton(page).click();
  await expect(cartDialog(page).getByText('Subtotal').locator('xpath=following-sibling::dd[1]')).toHaveText('$374.45');
  await expect(cartDialog(page).getByRole('listitem')).toHaveCount(2);
});

for (const { label, product, max, reason, announcement } of [
  {
    label: 'the 10-per-order policy',
    product: BACKPACK,
    max: 10,
    reason: 'Limit 10 per order',
    announcement: `Limit of 10 per order reached for ${BACKPACK.title}.`,
  },
  {
    label: 'simulated availability',
    product: SLIM_FIT,
    max: 5,
    reason: 'Only 5 available (demo inventory)',
    announcement: `Only 5 of ${SLIM_FIT.title} available (demo inventory).`,
  },
]) {
  test(`quantity limit: "+" is disabled at ${label}, with the reason shown and announced`, async ({ page }) => {
    await seedCart(page, [{ ...product, quantity: max }]);
    await openStore(page);
    const increase = productCard(page, product.title).getByRole('button', {
      name: `Increase quantity of ${product.title}`,
    });

    await expect(increase).toHaveAttribute('aria-disabled', 'true');
    await expect(increase).toHaveAccessibleDescription(reason);

    await increase.click({ force: true }); // aria-disabled stays clickable by design, so the reason is announced
    await expect(cartAnnouncer(page)).toHaveText(announcement);
    await expect(cartButton(page)).toHaveAccessibleName(`Cart, ${max} items`);
  });
}
