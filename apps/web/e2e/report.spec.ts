import { expect, test } from '@playwright/test';
import { addRow, signUp } from './helpers';

test.describe('månadsrapporten', () => {
  test('en sökt ansökan hamnar i månadens rapport', async ({ page }) => {
    await signUp(page);
    await addRow(page, {
      board: '/ansokningar',
      company: 'Acme AB',
      title: 'Ekonomiassistent',
      salary: '45 000 kr/mån',
    });

    await page.goto('/rapport');
    await expect(page.getByRole('heading', { level: 1, name: 'Rapport' })).toBeVisible();
    // Singular with one row: "1 rad att rapportera".
    await expect(page.getByText(/rade?r? att rapportera/)).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Acme AB' })).toBeVisible();
  });

  test('en aktivitet kan läggas till och uteslutas', async ({ page }) => {
    await signUp(page);
    await page.goto('/rapport');

    await page.getByRole('button', { name: 'Aktivitet' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Vad gjorde du?').fill('Jobbmässa i Kista');
    await dialog.getByLabel('Arrangör eller organisation').fill('Arbetsförmedlingen');
    await dialog.getByRole('button', { name: 'Spara' }).click();

    await expect(page.getByRole('cell', { name: 'Jobbmässa i Kista' })).toBeVisible();

    await page
      .getByRole('row', { name: /Jobbmässa i Kista/ })
      .getByRole('button', { name: 'Uteslut' })
      .click();
    await expect(page.getByText(/Uteslutna rader/)).toBeVisible();
  });

  test('appen är tydlig med att den inte är Arbetsförmedlingen', async ({ page }) => {
    await signUp(page);
    await page.goto('/rapport');
    await expect(page.getByText(/ingen koppling till Arbetsförmedlingen/)).toBeVisible();
  });
});
