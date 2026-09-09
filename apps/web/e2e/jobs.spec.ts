import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test.describe('annonssök', () => {
  test('en sökning visar träffar som kan sparas', async ({ page }) => {
    await signUp(page);
    await page.goto('/annonser');

    // Newest ads load without a phrase; refine with a search term.
    await expect(page.getByText(/annonser i Platsbanken|Söker i Platsbanken/)).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel('Sök jobb').fill('Ekonomiassistent');
    await page.getByRole('button', { name: 'Sök', exact: true }).click();

    const card = page.getByRole('article').filter({ hasText: 'Ekonomiassistent till Acme AB' });
    await expect(card).toBeVisible();
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

  test('filtren låter dig välja flera kommuner efter län', async ({ page }) => {
    await signUp(page);
    await page.goto('/annonser');
    await page.getByRole('button', { name: 'Filter' }).click();

    await expect(page.getByText('Välj minst ett län först')).toBeVisible();
    await expect(page.getByText('Välj minst ett yrkesområde först')).toBeVisible();

    await page.getByRole('checkbox', { name: 'Stockholms län' }).click();
    await expect(page.getByRole('checkbox', { name: 'Stockholm' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('checkbox', { name: 'Botkyrka' }).click();
    await expect(page.getByRole('checkbox', { name: 'Botkyrka' })).toBeChecked();
  });

  test('läs annonsen öppnar modal i stället för extern länk', async ({ page }) => {
    await signUp(page);
    await page.goto('/annonser');
    await page.getByLabel('Sök jobb').fill('Ekonomiassistent');
    await page.getByRole('button', { name: 'Sök', exact: true }).click();

    const card = page.getByRole('article').filter({ hasText: 'Ekonomiassistent till Acme AB' });
    await card.getByRole('button', { name: 'Läs annonsen' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Ansök hos arbetsgivaren')).toBeVisible();
  });

  test('en sökning utan träffar säger det rakt ut', async ({ page }) => {
    await signUp(page);
    await page.goto('/annonser');
    await page.getByLabel('Sök jobb').fill('finnsabsolutinte');
    await page.getByRole('button', { name: 'Sök', exact: true }).click();
    await expect(page.getByText('Inga träffar')).toBeVisible();
  });
});
