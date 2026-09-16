import { test, expect, type Page } from '@playwright/test';
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
  await page.getByRole('button', { name: 'Continuar sin guía' }).click();
  for (const key of ['Dos', 'Sumar', 'Tres', 'Igual, calcular'])
    await page.getByRole('button', { name: key, exact: true }).click();
  await expect(page.getByLabel('Resultado: 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sumar resultado a memoria', exact: true }).click();
  await expect(page.locator('.memory-bar span')).toHaveText('M: 5');
  for (const key of ['Multiplicar', 'Dos', 'Igual, calcular'])
    await page.getByRole('button', { name: key, exact: true }).click();
  await expect(page.getByLabel('Resultado: 10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Borrar toda la expresión' }).click();
  await page.getByRole('button', { name: 'Recuperar memoria' }).click();
  await expect(page.getByLabel('Expresión matemática', { exact: true })).toHaveValue('(5)');
  await page.reload();
  await expect(page.locator('.memory-bar span')).toHaveText('M: 5');
  await page.getByRole('button', { name: 'Uno', exact: true }).click();
  await page.getByRole('button', { name: 'Dos', exact: true }).click();
  await page.getByRole('button', { name: 'Borrar último carácter' }).click();
  await expect(page.getByLabel('Expresión matemática', { exact: true })).toHaveValue('1');
});
test('hover anuncia, no repite al moverse dentro, foco anuncia y Escape cancela pendientes', async ({
  page,
}) => {
  await mockSpeech(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Activar voz automática', exact: true }).click();
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
  await page.getByRole('button', { name: 'Desactivar voz automática' }).click();
  const before = (await spoken(page)).length;
  await page.getByRole('button', { name: 'Cuatro', exact: true }).hover();
  await page.waitForTimeout(250);
  expect((await spoken(page)).length).toBe(before);
});
test('formulario simbólico deriva e integra con explicación', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar sin guía' }).click();
  await page.getByRole('combobox', { name: 'Operación simbólica' }).selectOption('diff');
  await page.getByRole('button', { name: 'Calcular operación', exact: true }).click();
  await expect(page.getByLabel('Resultado: 3*x^2', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Operación simbólica' }).selectOption('integrate');
  await page.getByRole('button', { name: 'Calcular operación', exact: true }).click();
  await expect(page.getByLabel('Resultado: (1/3)*x^3 + C', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explicar resultado' }).click();
  await expect(page.getByText('C es una constante', { exact: false }).last()).toBeVisible();
  await page.getByRole('combobox', { name: 'Operación simbólica' }).selectOption('system');
  await page.getByRole('button', { name: 'Calcular operación', exact: true }).click();
  await expect(page.getByLabel('Resultado: x = 7; y = 3', { exact: true })).toBeVisible();
});
