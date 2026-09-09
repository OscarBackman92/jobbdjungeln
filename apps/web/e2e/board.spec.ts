import { expect, test } from '@playwright/test';
import { addRow, signUp } from './helpers';

test.describe('tavlorna', () => {
  test('ett sparat jobb kan läggas till, sökas fram och markeras som sökt', async ({
    page,
  }) => {
    await signUp(page);

    await addRow(page, { board: '/sparade', company: 'Acme AB', title: 'Ekonomiassistent' });
    await expect(page.getByText('Ekonomiassistent')).toBeVisible();
    await expect(page.getByText('Acme AB')).toBeVisible();

    // A saved job with no deadline lands in the two-week lane.
    await expect(page.getByRole('button', { name: /Den här månaden|Bråttom/ })).toBeVisible();

    // Moving it out of the wishlist asks for the salary expectation first.
    await page.getByRole('button', { name: /^Status: Sparad/ }).click();
    await page.getByRole('menuitem', { name: 'Ansökt' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Vad begärde du i lön?')).toBeVisible();
    await dialog.getByLabel('Löneanspråk').fill('45 000 kr/mån');
    await dialog.getByRole('button', { name: 'Spara och flytta' }).click();

    await page.goto('/ansokningar');
    await expect(page.getByText('Ekonomiassistent')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Status: Ansökt/ })).toBeVisible();
  });

  test('en ansökan kan sökas fram och sökningen kan rensas', async ({ page }) => {
    await signUp(page);
    await addRow(page, {
      board: '/ansokningar',
      company: 'Beta Handel AB',
      title: 'Orderadministratör',
      salary: '38 000 kr/mån',
    });
    await addRow(page, {
      board: '/ansokningar',
      company: 'Gamma IT',
      title: 'Systemtekniker',
      salary: '42 000 kr/mån',
    });

    await page.getByLabel('Sök i listan').fill('Beta');
    await expect(page.getByText('Orderadministratör')).toBeVisible();
    await expect(page.getByText('Systemtekniker')).toBeHidden();

    await page.getByRole('button', { name: 'Rensa sökningen' }).click();
    await expect(page.getByText('Systemtekniker')).toBeVisible();
  });

  test('detaljvyn visar tidslinjen och kan spara ändringar', async ({ page }) => {
    await signUp(page);
    await addRow(page, {
      board: '/ansokningar',
      company: 'Acme AB',
      title: 'Ekonomiassistent',
      salary: '45 000 kr/mån',
    });

    await page
      .getByRole('button', { name: /Ekonomiassistent/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Ekonomiassistent' })).toBeVisible();

    await dialog.getByLabel('Ort').fill('Stockholm');
    await dialog.getByRole('button', { name: 'Spara' }).click();

    await dialog.getByRole('tab', { name: /Tidslinje/ }).click();
    await dialog.getByPlaceholder('Vad hände?').fill('Ringde rekryteraren');
    await dialog.getByRole('button', { name: 'Lägg till' }).click();
    await expect(dialog.getByText('Ringde rekryteraren')).toBeVisible();
  });

  test('en tom tavla förklarar vad som saknas', async ({ page }) => {
    await signUp(page);
    await page.goto('/sparade');
    await expect(page.getByText('Inga sparade jobb')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sök jobb' })).toBeVisible();
  });
});
