import { expect, test } from '@playwright/test';
import { BACKPACK, cartButton, cartDialog, openStore, productCard } from './support';

test('cross-tab sync: a change in one tab appears in the other, both ways (FR-011, US3-AS2)', async ({ context }) => {
  // Two tabs in one browser profile share localStorage; the `storage` event only fires in the *other* tab.
  const tabA = await context.newPage();
  const tabB = await context.newPage();
  await openStore(tabA);
  await openStore(tabB);

  await productCard(tabA, BACKPACK.title).getByRole('button', { name: `Add ${BACKPACK.title} to cart` }).click();
  await expect(cartButton(tabB)).toHaveAccessibleName('Cart, 1 item', { timeout: 1_000 }); // SC-007: < 1 s
  await expect(
    productCard(tabB, BACKPACK.title).getByRole('textbox', { name: `Quantity of ${BACKPACK.title}` }),
  ).toHaveValue('1');

  await cartButton(tabB).click();
  // At quantity 1 the line has two controls with this name ("−" and the trash button); use the trash button.
  await cartDialog(tabB).getByRole('button', { name: `Remove ${BACKPACK.title} from cart` }).last().click();
  await expect(cartButton(tabA)).toHaveAccessibleName('Cart, 0 items', { timeout: 1_000 });
});
