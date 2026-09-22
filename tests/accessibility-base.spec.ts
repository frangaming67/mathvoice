import { expect, test } from '@playwright/test';
import { openTool } from './navigation';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    Object.defineProperty(window, '__spoken', { value: spoken });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [],
        speak: (u: SpeechSynthesisUtterance) => spoken.push(u.text),
        cancel() {},
        pause() {},
        resume() {},
        addEventListener() {},
        removeEventListener() {},
      },
    });
    class Recognition {
      onresult?: (e: { results: { transcript: string }[][] }) => void;
      onend?: () => void;
      start() {
        Object.assign(window, { __recognition: this });
      }
      stop() {
        this.onend?.();
      }
      abort() {
        Object.assign(window, { __aborted: true });
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: Recognition });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla', exact: true }).click();
});

test('orientación anuncia sección, borrador, resultado, error y teclado sin modificar datos', async ({
  page,
}) => {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill('2+3');
  await expression.press('Enter');
  await expect(page.getByLabel('Resultado: 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '¿Dónde estoy?' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Calculadora. Modo escritura. Lector de pantalla externo',
  );
  await expect(page.getByRole('status')).toContainText('Hay resultado: 5');
  await expect(page.getByRole('status')).toContainText('Teclado de botones cerrado');
  await expect(expression).toHaveValue('2+3');
  await openTool(page, 'Álgebra y cálculo');
  await page.getByLabel('Función o ecuación', { exact: true }).fill('x^3');
  await page.getByRole('button', { name: '¿Dónde estoy?' }).click();
  await expect(page.getByRole('status')).toContainText('Álgebra y cálculo');
  await expect(page.getByRole('status')).toContainText('equis al cubo');
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await page.getByRole('button', { name: '¿Dónde estoy?' }).click();
  await expect(page.getByRole('status')).toContainText('Historial.');
  await expect(page.getByRole('status')).toContainText('Sin expresión en esta sección');
});

test('F1 repetido conserva el punto original de retorno', async ({ page }) => {
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  const theme = page.getByRole('combobox', { name: 'Tema', exact: true });
  await theme.focus();
  await page.keyboard.press('F1');
  await page.keyboard.press('F1');
  await page.getByRole('button', { name: 'Cerrar ayuda' }).click();
  await expect(theme).toBeFocused();
});

test('lector externo evita síntesis automática incluso al revisar y confirmar dictado', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Dictar expresión', exact: true }).click();
  await page.evaluate(() => {
    (
      window as unknown as { __recognition: { onresult: (e: unknown) => void } }
    ).__recognition.onresult({ results: [[{ transcript: 'dos más tres' }]] });
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Entendí:');
  await page.getByRole('button', { name: 'Confirmar y calcular' }).click();
  await expect(page.getByLabel('Resultado: 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '¿Dónde estoy?' }).hover();
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual(
    [],
  );
  await page.getByRole('button', { name: 'Escuchar resultado', exact: true }).click();
  expect(
    await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length),
  ).toBe(1);
});

test('abandonar la herramienta cancela micrófono y descarta reconocimiento tardío', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Dictar expresión', exact: true }).click();
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { __aborted: boolean }).__aborted)).toBe(
    true,
  );
  expect(
    await page.evaluate(
      () => (window as unknown as { __recognition: { onresult: unknown } }).__recognition.onresult,
    ),
  ).toBeNull();
  await page.getByRole('link', { name: 'Calculadora', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dictar expresión', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
