import { test, expect, type Page } from '@playwright/test';
import { openTool, pressKey, resultValue } from './navigation';
async function mockSpeech(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = [];
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
    Object.defineProperty(window, '__spoken', { value: spoken });
  });
}
const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
test('teclado completo, continuidad del resultado, borrar y memoria', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  for (const key of ['Dos', 'Sumar', 'Tres', 'Igual, calcular']) await pressKey(page, key);
  await expect(resultValue(page, '5')).toBeVisible();
  await pressKey(page, 'Sumar resultado a memoria');
  // Después de un resultado, un operador sigue con Ans, como en la calculadora de mano.
  for (const key of ['Multiplicar', 'Dos']) await pressKey(page, key);
  await expect(expression).toHaveValue('ans*2');
  await pressKey(page, 'Igual, calcular');
  await expect(resultValue(page, '10')).toBeVisible();
  await pressKey(page, 'Borrar toda la expresión');
  await pressKey(page, 'Recuperar memoria', 'Alpha');
  await expect(expression).toHaveValue('(5)');
  await page.reload();
  await pressKey(page, 'Borrar toda la expresión');
  await pressKey(page, 'Recuperar memoria', 'Alpha');
  await expect(expression).toHaveValue('(5)');
  await pressKey(page, 'Uno');
  await pressKey(page, 'Dos');
  await pressKey(page, 'Borrar último carácter');
  await expect(expression).toHaveValue('(5)1');
});
test('hover anuncia, no repite al moverse dentro, foco anuncia y Escape cancela pendientes', async ({
  page,
}) => {
  await mockSpeech(page);
  await page.goto('/');
  // Primera visita: la bienvenida pregunta cómo escuchar.
  await page.getByRole('button', { name: 'Activar guía por voz', exact: true }).click();
  const seven = page.getByRole('button', { name: 'Siete', exact: true });
  await seven.hover();
  await expect.poll(() => spoken(page)).toContain('Siete');
  const count = (await spoken(page)).filter((text) => text === 'Siete').length;
  await seven.hover({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(250);
  expect((await spoken(page)).filter((text) => text === 'Siete')).toHaveLength(count);
  await page.getByRole('button', { name: 'Ocho', exact: true }).focus();
  await expect.poll(() => spoken(page)).toContain('Ocho');
  await page.getByRole('button', { name: 'Nueve', exact: true }).hover();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  expect(await spoken(page)).not.toContain('Nueve');
  await page.getByRole('button', { name: 'Guía por voz', exact: true, pressed: true }).click();
  const before = (await spoken(page)).length;
  await page.getByRole('button', { name: 'Cuatro', exact: true }).hover();
  await page.waitForTimeout(250);
  expect((await spoken(page)).length).toBe(before);
});
test('formulario simbólico deriva e integra con explicación', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
  await openTool(page, 'Álgebra y cálculo');
  await page.getByRole('combobox', { name: 'Operación simbólica' }).selectOption('diff');
  await page.getByRole('button', { name: 'Calcular operación', exact: true }).click();
  await expect(resultValue(page, '3*x^2')).toBeVisible();
  await page.getByRole('combobox', { name: 'Operación simbólica' }).selectOption('integrate');
  await page.getByRole('button', { name: 'Calcular operación', exact: true }).click();
  await expect(resultValue(page, '(1/3)*x^3 + C')).toBeVisible();
  await page.getByRole('button', { name: 'Explicar resultado' }).click();
  await expect(page.getByText('C es una constante', { exact: false }).last()).toBeVisible();
  await page.getByRole('combobox', { name: 'Operación simbólica' }).selectOption('system');
  await page.getByRole('button', { name: 'Calcular operación', exact: true }).click();
  await expect(resultValue(page, 'x = 7; y = 3')).toBeVisible();
});
