import { openTool } from './navigation';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

test('procedimiento leído, accesible, exportable y conservado en el historial', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    Object.defineProperty(window, '__spoken', { value: spoken });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [],
        speak: (utterance: SpeechSynthesisUtterance) => spoken.push(utterance.text),
        cancel: () => {},
        pause: () => {},
        resume: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Activar voz automática', exact: true }).click();
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill('solve(x^2-5*x+6=0,x)');
  await expression.press('Enter');
  const result = page.getByRole('region', { name: 'Resultado', exact: true });
  await result.getByText('Procedimiento paso a paso (6 pasos)', { exact: true }).click();
  await expect(result.getByText('Calcular el discriminante.', { exact: true })).toBeVisible();
  await result.locator('[data-speech^="Paso 1."]').hover();
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  await expect.poll(spoken).toContainEqual(expect.stringContaining('Paso 1. Reunir los términos.'));
  await result.getByRole('button', { name: 'Escuchar paso 3: Calcular el discriminante' }).click();
  await expect
    .poll(spoken)
    .toContainEqual(expect.stringContaining('Paso 3. Calcular el discriminante.'));
  await result.getByRole('button', { name: 'Escuchar todos los pasos' }).click();
  await expect.poll(spoken).toContainEqual(expect.stringMatching(/Paso 1\..*Paso 6\./));
  await page.waitForTimeout(250);
  expect((await spoken()).at(-1)).toMatch(/Paso 1\..*Paso 6\./);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('.result').analyze()).violations).toEqual([]);
  await result.screenshot({ path: 'test-results/procedimiento-mobile.png' });
  const downloading = page.waitForEvent('download');
  await result.getByRole('button', { name: 'Guardar resultado TXT' }).click();
  const download = await downloading;
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('Paso 3. Calcular el discriminante.');
  expect(text).toContain('Paso 6. Verificar');
  await page.reload();
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  const history = page.locator('#history');
  await history.getByText('Procedimiento paso a paso (6 pasos)', { exact: true }).click();
  await expect(history.getByText('Calcular el discriminante.', { exact: true })).toBeVisible();
});

test('salto a intersección selecciona la curva y devuelve el foco al explorador', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
  await openTool(page, 'Gráficos');
  await page.getByLabel('Funciones de x, una por línea (hasta 4)').fill('x\n-x');
  await page.getByRole('button', { name: 'Graficar funciones' }).click();
  await page.getByText('Puntos importantes y descripción textual', { exact: true }).click();
  const jump = page.getByRole('button', {
    name: 'Explorar intersección de función 1 y función 2 en x 0',
    exact: true,
  });
  await expect(jump).toHaveCount(1);
  await page.getByLabel('Función a explorar').selectOption('1');
  await jump.click();
  await expect(page.getByLabel('Función a explorar')).toHaveValue('0');
  await expect(page.getByRole('button', { name: 'Explorar gráfico', exact: true })).toBeFocused();
  await expect(page.locator('.coordinates')).toHaveText('Equis igual a 0; ye igual a 0');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.coordinates')).toHaveText('Equis igual a 0.1; ye igual a 0.1');
});
