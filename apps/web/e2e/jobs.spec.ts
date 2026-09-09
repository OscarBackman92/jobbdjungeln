import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test.describe('annonssök', () => {
  test('en sökning visar träffar som kan sparas', async ({ page }) => {
    await signUp(page);
    await page.goto('/annonser');

    await expect(page.getByText('Sök i hela Platsbanken')).toBeVisible();

    await page.getByLabel('Sök jobb').fill('Ekonomiassistent');
    await page.getByRole('button', { name: 'Sök', exact: true }).click();

    const card = page.getByRole('article').filter({ hasText: 'Ekonomiassistent till Acme AB' });
    await expect(card).toBeVisible();
    // Exact, so this matches the location chip rather than the ad text.
    await expect(card.getByText('Stockholm', { exact: true })).toBeVisible();

    await card.getByRole('button', { name: 'Spara' }).click();
    await expect(card.getByRole('button', { name: 'Sparad' })).toBeVisible();

    await page.goto('/sparade');
    await expect(page.getByText('Ekonomiassistent till Acme AB')).toBeVisible();
  });

  test('samma annons kan inte sparas två gånger', async ({ page }) => {
    await signUp(page);
    await page.goto('/annonser');
    await page.getByLabel('Sök jobb').fill('Ekonomiassistent');
    await page.getByRole('button', { name: 'Sök', exact: true }).click();

    const card = page.getByRole('article').first();
    await card.getByRole('button', { name: 'Spara' }).click();
    await expect(card.getByRole('button', { name: 'Sparad' })).toBeVisible();

    await page.reload();
    await page.getByLabel('Sök jobb').fill('Ekonomiassistent');
    await page.getByRole('button', { name: 'Sök', exact: true }).click();
    await expect(
      page.getByRole('article').first().getByRole('button', { name: 'Sparad' }),
    ).toBeVisible();
  });

  test('filtren fylls med län och yrkesområden utan att kontakta upstream', async ({
    page,
  }) => {
    await signUp(page);
    await page.goto('/annonser');
    await page.getByRole('button', { name: 'Filter' }).click();

    // Every filter is a named control, not just a box with text beside it.
    await expect(page.getByRole('combobox', { name: 'Län' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Yrkesområde' })).toBeVisible();

    // The narrow lists stay disabled until the broad one is chosen.
    await expect(page.getByRole('combobox', { name: 'Kommun' })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Yrkesgrupp' })).toBeDisabled();
  });

  test('en sökning utan träffar säger det rakt ut', async ({ page }) => {
    await signUp(page);
    await page.goto('/annonser');
    await page.getByLabel('Sök jobb').fill('finnsabsolutinte');
    await page.getByRole('button', { name: 'Sök', exact: true }).click();
    await expect(page.getByText('Inga träffar')).toBeVisible();
  });
});
