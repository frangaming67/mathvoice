import type { Page } from '@playwright/test';

export async function openTool(page: Page, label: string) {
  await page
    .getByRole('navigation', { name: 'Secciones' })
    .getByRole('link', { name: 'Herramientas', exact: true })
    .click();
  await page.getByRole('button', { name: label, exact: true }).click();
}

export async function openKeypad(page: Page) {
  await page.getByText('Teclado de botones y memoria', { exact: true }).click();
}
