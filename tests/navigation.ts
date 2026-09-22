import type { Page } from '@playwright/test';

export async function openTool(page: Page, label: string) {
  await page
    .getByRole('combobox', { name: 'Elegir herramienta', exact: true })
    .selectOption({ label });
  await page.getByRole('button', { name: 'Abrir herramienta', exact: true }).click();
}

export async function openKeypad(page: Page) {
  await page.getByText('Teclado de botones y memoria', { exact: true }).click();
}
