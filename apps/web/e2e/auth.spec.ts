import { expect, test } from '@playwright/test';
import { PASSWORD, signIn, signUp, uniqueEmail } from './helpers';

test.describe('konto och inloggning', () => {
  test('en besökare kan skapa konto, logga ut och logga in igen', async ({ page }) => {
    const email = await signUp(page);

    await page.getByRole('button', { name: 'Kontomeny' }).click();
    await page.getByRole('menuitem', { name: /Logga ut/ }).click();
    await expect(page).toHaveURL('/');

    await signIn(page, email);
    await expect(page.getByRole('heading', { name: 'Översikt' })).toBeVisible();
  });

  test('skyddade sidor kräver inloggning och tar en tillbaka efteråt', async ({ page }) => {
    await page.goto('/sparade');
    await expect(page).toHaveURL(/\/logga-in\?nasta=%2Fsparade/);
  });

  test('fel lösenord avslöjar inte om adressen finns', async ({ page }) => {
    const email = await signUp(page);
    await page.getByRole('button', { name: 'Kontomeny' }).click();
    await page.getByRole('menuitem', { name: /Logga ut/ }).click();

    await page.goto('/logga-in');
    await page.getByLabel('E-post').fill(email);
    await page.getByLabel('Lösenord', { exact: true }).fill('helt fel lösenord');
    await page.getByRole('button', { name: 'Logga in' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('E-post eller lösenord stämmer inte');

    // The same message for an address that does not exist at all.
    await page.getByLabel('E-post').fill(uniqueEmail('finns-inte'));
    await page.getByRole('button', { name: 'Logga in' }).click();
    await expect(alert).toContainText('E-post eller lösenord stämmer inte');
  });

  test('lösenordet måste upprepas rätt', async ({ page }) => {
    await page.goto('/skapa-konto');
    await page.getByLabel('E-post').fill(uniqueEmail());
    await page.getByLabel('Lösenord', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Upprepa lösenordet').fill('något annat');
    await page.getByRole('button', { name: 'Skapa konto' }).click();
    await expect(page.getByText('Lösenorden är inte lika.')).toBeVisible();
  });

  test('en inloggad användare skickas bort från inloggningssidan', async ({ page }) => {
    await signUp(page);
    await page.goto('/logga-in');
    await expect(page).toHaveURL(/\/oversikt/);
  });
});
