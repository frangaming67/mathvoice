import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pressKey } from './navigation';

const step = (page: Page, number: number) =>
  page.getByRole('region', { name: new RegExp(`^Primeros pasos, paso ${number} de 6`) });
async function calculate(page: Page, text: string) {
  const field = page.getByLabel('Expresión matemática', { exact: true });
  await field.fill(text);
  await field.press('Enter');
}

test('la bienvenida ofrece el recorrido de primeros pasos', async ({ page }) => {
  await page.goto('/');
  const welcome = page.getByRole('dialog', { name: 'Bienvenido a MathVoice' });
  // El foco sigue empezando en la primera opción; el recorrido se marca aparte.
  await expect(welcome.getByRole('button', { name: 'Activar guía por voz' })).toBeFocused();
  await welcome.getByLabel(/Hacer el recorrido de primeros pasos/).check();
  await welcome.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
  await expect(step(page, 1)).toBeVisible();
  await expect(page.getByRole('status')).toContainText('paso 1 de 6: Tu primera cuenta');
});

test('primeros pasos avanza al hacer cada acción y se puede saltar o terminar', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
  await page.keyboard.press('F1');
  await page.getByRole('button', { name: 'Primeros pasos', exact: true }).click();
  await expect(step(page, 1)).toBeVisible();
  const status = page.getByRole('status');
  await calculate(page, '2+3');
  await expect(step(page, 2)).toBeVisible();
  await expect(status).toContainText('Muy bien: 2 más 3 es 5. Primeros pasos, paso 2 de 6');
  await calculate(page, '1/3+1/6');
  await expect(step(page, 3)).toBeVisible();
  await page.getByLabel('Expresión matemática', { exact: true }).fill('');
  await pressKey(page, 'Raíz cuadrada');
  await expect(step(page, 4)).toBeVisible();
  await pressKey(page, 'Menú de modos');
  await page.keyboard.press('9');
  await expect(step(page, 5)).toBeVisible();
  expect((await new AxeBuilder({ page }).include('.tutorial').analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Saltar este paso' }).click();
  await expect(step(page, 6)).toBeVisible();
  await expect(status).toContainText('paso 6 de 6: Siempre hay ayuda');
  await page.getByRole('button', { name: 'Terminar recorrido' }).click();
  await expect(page.locator('.tutorial')).toHaveCount(0);
  await expect(status).toContainText('Recorrido terminado');
});
