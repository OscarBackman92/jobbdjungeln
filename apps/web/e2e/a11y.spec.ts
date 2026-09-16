import { expect, test } from '@playwright/test';
import { addRow, signUp } from './helpers';

/**
 * Accessibility checks that are worth pinning: the things that silently rot as a
 * UI changes, and that a person relying on a keyboard or a screen reader would
 * notice immediately.
 */
test.describe('tillgänglighet', () => {
  test('varje sida har exakt en h1 och ett landmärke för huvudinnehållet', async ({ page }) => {
    await signUp(page);

    for (const path of [
      '/oversikt',
      '/sparade',
      '/ansokningar',
      '/annonser',
      '/rapport',
      '/profil',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Huvudmeny' }).first()).toBeVisible();
    }
  });

  test('hoppa-till-innehållet-länken går att nå med tangentbordet', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Hoppa till innehållet' })).toBeFocused();
  });

  test('formulärfält har etiketter som pekar på rätt kontroll', async ({ page }) => {
    await page.goto('/skapa-konto');
    await page.getByLabel('E-post').fill('a@example.test');
    await expect(page.getByLabel('E-post')).toHaveValue('a@example.test');

    // Clicking the label must move focus into its own field.
    await page.getByText('Upprepa lösenordet').click();
    await expect(page.getByLabel('Upprepa lösenordet')).toBeFocused();
  });

  test('en dialog fångar fokus och stängs med Escape', async ({ page }) => {
    await signUp(page);
    await page.goto('/sparade');
    await page.getByRole('button', { name: 'Nytt sparat jobb' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Arbetsgivare')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('diagrammen har en tabellvy för den som inte kan läsa dem', async ({ page }) => {
    await signUp(page);
    await addRow(page, {
      board: '/ansokningar',
      company: 'Acme AB',
      title: 'Ekonomiassistent',
      salary: '45 000 kr/mån',
    });

    await page.goto('/oversikt');
    const toggles = page.getByText('Visa som tabell');
    await expect(toggles.first()).toBeVisible();
    await toggles.first().click();
    await expect(page.getByRole('columnheader', { name: 'Steg' })).toBeVisible();
  });

  test('mörkt läge går att välja och färgerna följer med', async ({ page }) => {
    await signUp(page);
    await page.getByRole('radio', { name: 'Mörkt' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('radio', { name: 'Ljust' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('dialoger exponerar aria-modal', async ({ page }) => {
    await signUp(page);
    await page.goto('/sparade');
    await page.getByRole('button', { name: 'Nytt sparat jobb' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('publiceringsfilter är en radiogrupp', async ({ page }) => {
    await signUp(page);
    await page.goto('/annonser');
    await page.getByRole('button', { name: /^Filter/ }).click();
    const group = page.getByRole('radiogroup', { name: 'Publicerad' });
    await expect(group).toBeVisible();
    await group.getByRole('radio', { name: '7 dagar' }).check();
    await expect(group.getByRole('radio', { name: '7 dagar' })).toBeChecked();
  });
});
