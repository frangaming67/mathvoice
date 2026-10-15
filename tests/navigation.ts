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

const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/** El último resultado, por su sintaxis lineal visible (el valor accesible es MathML). */
export function resultValue(page: Page, value: string) {
  return page.locator('.result-syntax').filter({ hasText: exactly(value) });
}

/** Una entrada del historial, por la expresión tal como se escribió. */
export function historyEntry(page: Page, expression: string) {
  return page
    .locator('li.history-entry')
    .filter({ has: page.locator('.history-syntax', { hasText: exactly(expression) }) });
}
