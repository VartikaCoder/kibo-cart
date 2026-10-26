import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { BACKPACK, cartButton, cartDialog, openStore, seedCart } from './support';

// WCAG 2.2 A and AA (SC-003).
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test('axe: no violations on the listing', async ({ page }) => {
  await openStore(page);
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(results.violations).toEqual([]);
});

test('axe: no violations with the cart drawer open', async ({ page }) => {
  await seedCart(page, [{ ...BACKPACK, quantity: 10 }]); // at the limit, so the limit text is checked too
  await openStore(page);
  await cartButton(page).click();
  await expect(cartDialog(page)).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(results.violations).toEqual([]);
});

test('CSP: no violations reported while browsing and using the cart', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`);
    });
  });

  const response = await page.goto('/');
  test.skip(
    !response?.headers()['content-security-policy'],
    'No Content-Security-Policy header yet; this test enforces itself once the security headers land (research R10).',
  );

  await expect(cartButton(page)).toHaveAccessibleName(/^Cart, \d+ items?$/);
  await page.getByRole('button', { name: `Add ${BACKPACK.title} to cart` }).click();
  await cartButton(page).click();
  await expect(cartDialog(page)).toBeVisible();

  expect(violations).toEqual([]);
});
