import { expect, type Page } from '@playwright/test';

/** A fresh address per test, so tests never see each other's data. */
export function uniqueEmail(prefix = 'anna'): string {
  return `${prefix}+${Date.now()}-${Math.floor(Math.random() * 100_000)}@example.test`;
}

export const PASSWORD = 'ettbraLosenord123';

/** Register through the real form and land on the dashboard. */
export async function signUp(page: Page, email = uniqueEmail()): Promise<string> {
  await page.goto('/skapa-konto');
  await page.getByLabel('E-post').fill(email);
  await page.getByLabel('Lösenord', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Upprepa lösenordet').fill(PASSWORD);
  await page.getByRole('button', { name: 'Skapa konto' }).click();

  // Wait for the confirmation before navigating: the click only dispatches the
  // request, and going straight to a protected page would race the session
  // cookie being set.
  await expect(page.getByText('Kolla mejlen')).toBeVisible();

  // With verification switched off for the suite, that session is already live.
  await page.goto('/oversikt');
  await expect(page.getByRole('heading', { name: 'Översikt' })).toBeVisible();
  return email;
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/logga-in');
  await page.getByLabel('E-post').fill(email);
  await page.getByLabel('Lösenord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logga in' }).click();
  await expect(page).toHaveURL(/\/oversikt/);
}

/** Add a tracker row through the dialog on the given board. */
export async function addRow(
  page: Page,
  {
    board,
    company,
    title,
    salary,
  }: { board: '/sparade' | '/ansokningar'; company: string; title: string; salary?: string },
): Promise<void> {
  await page.goto(board);
  await page
    .getByRole('button', { name: /Nytt sparat jobb|Lägg till ansökan/ })
    .first()
    .click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Arbetsgivare').fill(company);
  await dialog.getByLabel('Roll').fill(title);
  if (salary) await dialog.getByLabel('Löneanspråk').fill(salary);
  await dialog.getByRole('button', { name: 'Spara' }).click();
  await expect(dialog).toBeHidden();
}
