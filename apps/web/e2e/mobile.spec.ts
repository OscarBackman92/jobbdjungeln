import { expect, test } from '@playwright/test';
import { addRow, signUp } from './helpers';

/** Most of a job hunt happens on a phone, so the small screen is not an afterthought. */
test.describe('mobil', () => {
  test.skip(({ isMobile }) => !isMobile, 'gäller bara mobilprojektet');

  test('bottenmenyn tar en runt appen', async ({ page }) => {
    await signUp(page);

    const nav = page.getByRole('navigation', { name: 'Huvudmeny' });
    await nav.getByRole('link', { name: 'Sparade' }).click();
    await expect(page).toHaveURL(/\/sparade/);

    await nav.getByRole('link', { name: 'Annonser' }).click();
    await expect(page).toHaveURL(/\/annonser/);
  });

  test('inget innehåll svämmar ut i sidled', async ({ page }) => {
    await signUp(page);
    await addRow(page, {
      board: '/ansokningar',
      company: 'Ett företag med ett ovanligt långt namn AB',
      title: 'Ekonomiassistent med lång titel',
      salary: '45 000 kr/mån',
    });

    for (const path of ['/oversikt', '/ansokningar', '/rapport']) {
      await page.goto(path);
      // Measure only once the page has actually rendered. Measuring a page
      // mid-render reports no overflow whatever the layout does, which let a
      // report table that dragged the page sideways pass most of the time.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (path === '/rapport') {
        await expect(page.getByRole('table')).toBeVisible();
      }

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} svämmar över i sidled`).toBeLessThanOrEqual(1);
    }
  });

  test('detaljvyn öppnas som ett ark underifrån', async ({ page }) => {
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
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
