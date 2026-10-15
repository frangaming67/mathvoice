import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { historyEntry, openTool, resultValue } from './navigation';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
});

test('una herramienta visible, resultado antes del teclado y cambio explícito con foco', async ({
  page,
}) => {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expect(expression).toBeFocused();
  await expect(page.getByRole('button', { name: 'Siete', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Operación simbólica' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Vaciar historial' })).toHaveCount(0);
  await expression.fill('7*8');
  await expression.press('Enter');
  await expect(resultValue(page, '56')).toBeVisible();
  expect(
    await page
      .locator('.result')
      .evaluate(
        (result) =>
          !!(
            result.compareDocumentPosition(document.getElementById('keypad-panel')!) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
  ).toBe(true);
  await page.keyboard.press('Alt+Shift+p');
  await page.getByRole('combobox', { name: 'Buscar comando' }).fill('Elegir herramienta');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Herramientas', exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveTitle('Herramientas — MathVoice');
  await expect(page.getByRole('button', { name: 'Calculadora', exact: true })).toBeFocused();
  await expect(expression).toBeHidden();
  // La lista es una sola parada de Tab: las flechas recorren las herramientas.
  for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Matrices', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Matrices', exact: true, level: 1 }),
  ).toBeFocused();
  await expect(expression).toBeHidden();
  await expect(page.getByRole('button', { name: 'Calcular matriz' })).toBeVisible();
  await page.keyboard.press('Alt+Shift+c');
  await expect(expression).toBeFocused();
  await expect(expression).toHaveValue('7*8');
});

test('conserva borradores y vuelve al formulario que produjo el resultado', async ({ page }) => {
  await openTool(page, 'Álgebra y cálculo');
  const body = page.getByLabel('Función o ecuación', { exact: true });
  await body.fill('x^2=25');
  await openTool(page, 'Matrices');
  const cell = page.getByRole('textbox', { name: 'Matriz A, fila 1, columna 1', exact: true });
  await cell.fill('9');
  await openTool(page, 'Álgebra y cálculo');
  await expect(body).toHaveValue('x^2=25');
  await page.getByRole('button', { name: 'Calcular operación' }).click();
  await expect(page.getByRole('region', { name: 'Resultado', exact: true })).toContainText('x = 5');
  await page.keyboard.press('Alt+Shift+r');
  await expect(page.getByRole('heading', { name: 'Resultado', exact: true })).toBeFocused();
  await openTool(page, 'Matrices');
  await expect(
    page.getByRole('textbox', { name: 'Matriz A, fila 1, columna 1', exact: true }),
  ).toHaveValue('9');
  // Results belong to their tool; returning restores the algebra result and its edit target.
  await expect(page.getByRole('button', { name: 'Volver a editar el cálculo' })).toHaveCount(0);
  await openTool(page, 'Álgebra y cálculo');
  await page.getByRole('button', { name: 'Volver a editar el cálculo' }).click();
  await expect(body).toBeFocused();
  await body.fill('sin(');
  await page.getByRole('button', { name: 'Calcular operación' }).click();
  await expect(page.getByRole('alert')).not.toBeEmpty();
  await expect(body).toBeFocused();
});

test('historial, configuración y ayuda tienen foco y retorno predecibles', async ({ page }) => {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill('2+3');
  await expression.press('Enter');
  await expect(resultValue(page, '5')).toBeVisible();
  await page.keyboard.press('Alt+Shift+h');
  await expect(
    page.getByRole('heading', { name: 'Historial', exact: true, level: 1 }),
  ).toBeFocused();
  await expect(page).toHaveTitle('Historial — MathVoice');
  await expect(expression).toBeHidden();
  await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  await historyEntry(page, '2+3').getByRole('button', { name: 'Editar' }).click();
  await expect(expression).toBeFocused();
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  const theme = page.getByRole('combobox', { name: 'Tema', exact: true });
  await expect(
    page.getByRole('heading', { name: 'Configuración', exact: true, level: 1 }),
  ).toBeFocused();
  await theme.focus();
  await theme.press('F1');
  await expect(page.getByRole('heading', { name: 'Ayuda', exact: true, level: 1 })).toBeFocused();
  await expect(theme).toBeHidden();
  await page.getByRole('button', { name: 'Cerrar ayuda' }).click();
  await expect(theme).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('salir del gráfico detiene el audio y conserva funciones y coordenadas', async ({ page }) => {
  await openTool(page, 'Gráficos');
  await page.getByLabel('Funciones de x, una por línea (hasta 4)').fill('x^2+1');
  await page.getByRole('button', { name: 'Graficar funciones' }).click();
  await page.getByRole('button', { name: 'Sonificar recorrido' }).click();
  await expect(page.getByRole('button', { name: 'Detener sonificación' })).toBeVisible();
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await openTool(page, 'Gráficos');
  await expect(page.getByRole('button', { name: 'Sonificar recorrido' })).toBeVisible();
  await expect(page.getByLabel('Funciones de x, una por línea (hasta 4)')).toHaveValue('x^2+1');
  await expect(page.getByRole('slider', { name: 'Explorar gráfico', exact: true })).toBeVisible();
});

test('primera visita: la bienvenida es un diálogo con el foco adentro y habla con la primera tecla', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    Object.defineProperty(window, '__spoken', { value: spoken });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: (utterance: SpeechSynthesisUtterance) => spoken.push(utterance.text),
        cancel: () => {},
        pause: () => {},
        resume: () => {},
        getVoices: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const dialog = page.getByRole('dialog', { name: 'Bienvenido a MathVoice' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Activar guía por voz' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Usar mi lector de pantalla' })).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken))
    .toContainEqual(expect.stringContaining('Enter activa la guía por voz'));
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel('Expresión matemática', { exact: true })).toBeFocused();
  await page.reload();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel('Expresión matemática', { exact: true })).toBeFocused();
});

test('cada vista dice dónde estás y la lista de herramientas es una sola parada de Tab', async ({
  page,
}) => {
  const sections = page.getByRole('navigation', { name: 'Secciones' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calculadora');
  await expect(sections.getByRole('link', { name: 'Calculadora' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await sections.getByRole('link', { name: 'Herramientas', exact: true }).click();
  await expect(page).toHaveTitle('Herramientas — MathVoice');
  const items = page.locator('.tool-item');
  await expect(items).toHaveCount(10);
  expect(await items.evaluateAll((list) => list.filter((item) => item.tabIndex === 0).length)).toBe(
    1,
  );
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'Variables', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('button', { name: 'Calculadora', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.classList.contains('tool-item'))).toBe(
    false,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Gráficos', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Gráficos', exact: true, level: 1 }),
  ).toBeFocused();
  await expect(page).toHaveTitle('Gráficos — MathVoice');
  const location = page.getByRole('navigation', { name: 'Ubicación' });
  await expect(location).toContainText('Herramientas › Gráficos');
  await location.getByRole('link', { name: 'Herramientas' }).click();
  await expect(page.getByRole('button', { name: 'Gráficos', exact: true })).toBeFocused();
  await sections.getByRole('link', { name: /^Ayuda/ }).click();
  await expect(page.getByRole('heading', { name: 'Ayuda', exact: true, level: 1 })).toBeFocused();
  await expect(page).toHaveTitle('Ayuda — MathVoice');
  await expect(page.getByRole('table')).toContainText('Alt + Shift + P');
  const helpControls = await page.evaluate(
    () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'main a[href], main button, main input, main select',
        ),
      ).filter((element) => element.getClientRects().length).length,
  );
  expect(helpControls).toBeLessThanOrEqual(10);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Teclado y atajos', exact: true }).click();
  await expect(page).toHaveTitle('Teclado y atajos — MathVoice');
  const keyboardControls = await page.evaluate(
    () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'main a[href], main button, main input, main select, main summary',
        ),
      ).filter((element) => element.getClientRects().length).length,
  );
  expect(keyboardControls).toBeLessThan(40);
  await expect(page.getByRole('table').first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
