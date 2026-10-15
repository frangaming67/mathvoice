import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { historyEntry, resultValue } from './navigation';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla', exact: true }).click();
});

async function calculate(page: Page, text: string, value: string) {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill(text);
  await expression.press('Enter');
  await expect(resultValue(page, value)).toBeVisible();
}
const entry = (id: string, minute: number, expression = `${minute}+1`) => ({
  id,
  date: new Date(2026, 0, 1, 0, minute).toISOString(),
  expression,
  value: String(minute + 1),
  kind: 'Básico',
  explanation: 'Suma',
  angleMode: 'rad',
});

test('el historial es una sola parada de Tab que se recorre con flechas y teclas', async ({
  page,
}) => {
  for (const [text, value] of [
    ['1+1', '2'],
    ['2+2', '4'],
    ['3+3', '6'],
  ])
    await calculate(page, text, value);
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).focus();
  await page.keyboard.press('Tab');
  const newest = historyEntry(page, '3+3');
  await expect(newest).toBeFocused();
  // Cada cálculo se nombra en palabras, no en sintaxis de programación.
  await expect(newest).toHaveAccessibleName('3 más 3, igual a 6');
  await page.keyboard.press('ArrowDown');
  await expect(historyEntry(page, '2+2')).toBeFocused();
  await page.keyboard.press('End');
  await expect(historyEntry(page, '1+1')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(newest).toBeFocused();
  // Una sola parada de Tab: los botones y pasos de cada entrada no suman paradas.
  await expect(page.locator('li.history-entry[tabindex="0"]')).toHaveCount(1);
  await expect(
    page.locator('li.history-entry :is(button, summary, a, input):not([tabindex="-1"])'),
  ).toHaveCount(0);
  // Suprimir elimina y deja el foco en el cálculo siguiente.
  await page.keyboard.press('ArrowDown');
  await expect(historyEntry(page, '2+2')).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(historyEntry(page, '2+2')).toHaveCount(0);
  await expect(historyEntry(page, '1+1')).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Cálculo eliminado. Quedan 2.');
  // Espacio lo escucha (con lector, por la región viva) y Enter lo lleva a editar.
  await page.keyboard.press(' ');
  await expect(page.getByRole('status')).toHaveText('1 más 1. Resultado: 2.');
  await page.keyboard.press('Enter');
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expect(expression).toBeFocused();
  await expect(expression).toHaveValue('1+1');
});

test('muestra de a 20 cálculos y la flecha abajo trae los siguientes', async ({ page }) => {
  await page.evaluate(
    (list) => localStorage.setItem('mathvoice.v1.history', JSON.stringify(list)),
    Array.from({ length: 25 }, (_, i) => entry(`e${i}`, 50 - i)),
  );
  await page.reload();
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await expect(page.getByText('Mostrando 20 de 25 cálculos.')).toBeVisible();
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('End');
  await expect(historyEntry(page, '31+1')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(historyEntry(page, '30+1')).toBeFocused();
  await expect(page.getByText('25 cálculos.', { exact: true })).toBeVisible();
});

test('conserva los cálculos sanos aunque otros estén dañados y guarda un respaldo', async ({
  page,
}) => {
  const raw = JSON.stringify([entry('sano', 5), { id: 'roto', expression: 4 }]);
  await page.evaluate((value) => localStorage.setItem('mathvoice.v1.history', value), raw);
  await page.reload();
  await expect(page.locator('.warning')).toContainText(
    'Se descartó 1 cálculo dañado del historial. Guardé una copia de respaldo.',
  );
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await expect(historyEntry(page, '5+1')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('mathvoice.v1.history.respaldo'))).toBe(
    raw,
  );
});

test('dos pestañas suman sus cálculos sin pisarse', async ({ page, context }) => {
  await calculate(page, '7*6', '42');
  const other = await context.newPage();
  await other.goto('/');
  await calculate(other, '9*9', '81');
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await expect(historyEntry(page, '9*9')).toBeVisible();
  await expect(historyEntry(page, '7*6')).toBeVisible();
  // Lo que se calcula después en la primera pestaña no borra lo de la otra.
  await page.getByRole('link', { name: 'Calculadora', exact: true }).click();
  await calculate(page, '5-3', '2');
  const saved = await other.evaluate(() =>
    JSON.parse(localStorage.getItem('mathvoice.v1.history')!).map(
      (item: { expression: string }) => item.expression,
    ),
  );
  expect(saved).toEqual(['5-3', '9*9', '7*6']);
  await other.close();
});

test('el informe HTML lleva las fórmulas en MathML y la vista pasa axe', async ({ page }) => {
  await calculate(page, '1/3 + 1/6', '1/2');
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar informe para imprimir (HTML)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('mathvoice-historial.html');
  const html = await (await file.createReadStream()).toArray();
  const text = Buffer.concat(html).toString('utf8');
  expect(text).toContain('<math');
  expect(text).toContain('un tercio más un sexto');
  const results = await new AxeBuilder({ page }).include('#history').analyze();
  expect(results.violations).toEqual([]);
});
