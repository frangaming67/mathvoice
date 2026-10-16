import { openTool, resultValue } from './navigation';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
});

test('atajos de herramientas, Taylor y graficar resultado', async ({ page }) => {
  await page.keyboard.press('Alt+Shift+d');
  await expect(page.getByLabel('Operación simbólica')).toBeFocused();
  await expect(page.getByLabel('Operación simbólica')).toHaveValue('diff');
  await page.getByRole('button', { name: 'Calcular operación' }).click();
  await expect(resultValue(page, '3*x^2')).toBeVisible();
  await page.getByRole('button', { name: 'Graficar resultado', exact: true }).click();
  await expect(page.getByLabel('Funciones de x, una por línea (hasta 4)')).toHaveValue('3*x^2');
  await page.keyboard.press('Alt+Shift+m');
  await expect(
    page.getByRole('heading', { name: 'Matrices', exact: true, level: 1 }),
  ).toBeFocused();
  await page.keyboard.press('Alt+Shift+p');
  await page.getByRole('combobox', { name: 'Buscar comando' }).fill('Abrir integrales');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Operación simbólica')).toHaveValue('integrate');
  await page.keyboard.press('Alt+Shift+l');
  await expect(page.getByLabel('Operación simbólica')).toHaveValue('limit');
  await page.getByLabel('Operación simbólica').selectOption('series');
  await page.getByLabel('Orden de Taylor').fill('3');
  await page.getByRole('button', { name: 'Calcular operación' }).click();
  await expect(page.getByRole('region', { name: 'Resultado', exact: true })).toContainText('x^3');
  await page.getByRole('button', { name: 'Explicar resultado' }).click();
  await expect(page.getByRole('region', { name: 'Resultado', exact: true })).toContainText(
    'aproximación local',
  );
});

test('escala general persistente y reflow equivalente a 320 píxeles', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 1000 });
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await page.getByRole('combobox', { name: 'Escala general', exact: true }).selectOption('2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Escala general', exact: true })).toHaveValue(
    '2',
  );
  await page.getByRole('combobox', { name: 'Escala general', exact: true }).selectOption('1');
  await page.setViewportSize({ width: 320, height: 800 });
  await openTool(page, 'Conversores');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('matriz editable con flechas, inversa tabular y estadística', async ({ page }) => {
  await openTool(page, 'Matrices');
  const cell = (row: number, column: number) =>
    page.getByRole('textbox', { name: `Matriz A, fila ${row}, columna ${column}`, exact: true });
  const first = cell(1, 1);
  await first.focus();
  // Las flechas laterales recorren el texto y pasan a la celda vecina desde el borde.
  await first.evaluate((input: HTMLInputElement) => input.setSelectionRange(0, 0));
  await first.press('ArrowRight');
  await expect(first).toBeFocused();
  await first.press('ArrowRight');
  await expect(cell(1, 2)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(cell(2, 2)).toBeFocused();
  await expect(cell(2, 2)).toHaveValue('4');
  await page.getByRole('button', { name: 'Calcular matriz' }).click();
  await expect(resultValue(page, '-2')).toBeVisible();
  await page.getByLabel('Operación matricial').selectOption('inv');
  await page.getByRole('button', { name: 'Calcular matriz' }).click();
  const result = page.getByRole('region', { name: 'Resultado', exact: true });
  await expect(result.getByRole('cell', { name: '-0.5', exact: true })).toBeVisible();
  await openTool(page, 'Estadística');
  await page.getByRole('button', { name: 'Calcular estadística' }).click();
  await expect(result.getByRole('cell', { name: '2.5', exact: true })).toBeVisible();
  await expect(result.getByRole('row', { name: /Media 3/ })).toBeVisible();
});

test('variables persistentes, conversión de temperatura y exportación', async ({ page }) => {
  const input = page.getByLabel('Expresión matemática', { exact: true });
  await input.fill('radio=7');
  await input.press('Enter');
  await expect(resultValue(page, '7')).toBeVisible();
  await page.reload();
  await input.fill('radio*2');
  await input.press('Enter');
  await expect(resultValue(page, '14')).toBeVisible();
  await openTool(page, 'Conversores');
  await page.getByLabel('Categoría de unidades').selectOption('Temperatura');
  await page.getByLabel('Valor a convertir').fill('25');
  await page.getByLabel('Unidad de origen').selectOption('degC');
  await page.getByLabel('Unidad de destino').selectOption('degF');
  await page.getByRole('button', { name: 'Convertir unidades' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Resultado', exact: true })
      .getByRole('cell', { name: '77', exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await page.getByRole('button', { name: /Exportar JSON/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});

test('gráfico: paso exacto de 0.01, bordes, tabla y Escape', async ({ page }) => {
  await openTool(page, 'Gráficos');
  await page.getByRole('button', { name: 'Graficar funciones' }).click();
  const explore = page.getByRole('slider', { name: 'Explorar gráfico', exact: true });
  await expect(explore).toBeVisible();
  await page.getByLabel('Paso en X').selectOption('0.01');
  await explore.focus();
  await explore.press('ArrowRight');
  await expect(page.locator('.coordinates')).toContainText('Equis igual a -4.99');
  await explore.press('End');
  await explore.press('ArrowRight');
  await expect(page.locator('.coordinates')).toContainText('Equis igual a 5; ye igual a 25');
  await page.getByRole('button', { name: 'Sonificar recorrido' }).click();
  await expect(page.getByRole('button', { name: 'Detener sonificación' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Sonificar recorrido' })).toBeVisible();
  await page
    .getByText('Tabla completa de valores de la función seleccionada', { exact: true })
    .click();
  await expect(page.locator('.graph-table tbody tr')).toHaveCount(401);
});

test('herramientas abiertas: accesibilidad y reflow móvil', async ({ page }) => {
  for (const name of [
    'Matrices',
    'Vectores y complejos',
    'Estadística',
    'Probabilidad',
    'Variables',
    'Conversores',
    'Tabla de valores',
    'Proporciones',
    'Gráficos',
  ]) {
    await openTool(page, name);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
  }
  await page.getByRole('button', { name: 'Graficar funciones' }).click();
  await expect(page.getByRole('slider', { name: 'Explorar gráfico', exact: true })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 800 });
  await openTool(page, 'Matrices');
  await page.getByLabel('Columnas de A').selectOption('6');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('dictado requiere confirmar; cancelar y permiso denegado no calculan', async ({ page }) => {
  await page.addInitScript(() => {
    class Recognition {
      onresult?: (event: { results: { transcript: string }[][] }) => void;
      onerror?: (event: { error: string }) => void;
      onend?: () => void;
      start() {
        if (sessionStorage.getItem('denyMic')) this.onerror?.({ error: 'not-allowed' });
        else this.onresult?.({ results: [[{ transcript: 'dos coma cero cinco más uno' }]] });
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: Recognition });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Dictar expresión' }).click();
  const dialog = page.getByRole('dialog', { name: 'Revisar dictado' });
  await expect(dialog.getByRole('textbox')).toHaveValue('2.05+1');
  await expect(resultValue(page, '3.05')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dictar expresión' })).toBeFocused();
  await page.getByRole('button', { name: 'Dictar expresión' }).click();
  await dialog.getByRole('button', { name: 'Confirmar y calcular' }).click();
  await expect(resultValue(page, '3.05')).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('denyMic', '1'));
  await page.getByRole('button', { name: 'Dictar expresión' }).click();
  await expect(page.getByRole('status')).toContainText('No se permitió usar el micrófono');
  await expect(dialog).not.toBeVisible();
});

test('dictado marca palabras no entendidas y no calcula hasta corregirlas', async ({ page }) => {
  await page.addInitScript(() => {
    class Recognition {
      onresult?: (event: { results: { transcript: string }[][] }) => void;
      onend?: () => void;
      start() {
        this.onresult?.({ results: [[{ transcript: 'derivada de seno de pepito' }]] });
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: Recognition });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Dictar expresión' }).click();
  const dialog = page.getByRole('dialog', { name: 'Revisar dictado' });
  await expect(dialog).toContainText('No entendí «pepito»');
  const field = dialog.getByRole('textbox');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('button', { name: 'Confirmar y calcular' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await field.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText('Corregilas');
  await expect(field).toBeFocused();
  await field.fill('diff(sin(x),x)');
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  await dialog.getByRole('button', { name: 'Confirmar y calcular' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(resultValue(page, 'cos(x)')).toBeVisible();
});

test('Escape cancela la escucha y descarta un reconocimiento tardío', async ({ page }) => {
  await page.addInitScript(() => {
    type Late = { onresult: ((event: unknown) => void) | null };
    const state = window as unknown as { __late?: Late; __aborted?: boolean };
    class Recognition {
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        state.__late = this;
      }
      stop() {}
      abort() {
        state.__aborted = true;
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: Recognition });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Dictar expresión' }).click();
  await expect(page.getByRole('button', { name: 'Cancelar dictado' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Dictar expresión' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Dictado cancelado');
  const aborted = await page.evaluate(() => {
    const state = window as unknown as {
      __late?: { onresult: ((event: unknown) => void) | null };
      __aborted?: boolean;
    };
    state.__late?.onresult?.({ results: [[{ transcript: 'dos más dos' }]] });
    return state.__aborted;
  });
  expect(aborted).toBe(true);
  await expect(page.getByRole('dialog', { name: 'Revisar dictado' })).not.toBeVisible();
});

test('estadística lee la coma decimal, confirma los datos y pregunta si es ambigua', async ({
  page,
}) => {
  await openTool(page, 'Estadística');
  const data = page.getByLabel('Datos X', { exact: true });
  await data.fill('1,5;2,5;3,5');
  await page.getByLabel('Análisis estadístico').selectOption('mean');
  await page.getByRole('button', { name: 'Calcular estadística' }).click();
  await expect(page.getByText('Se leyeron 3 datos: 1,5; 2,5; 3,5.')).toBeVisible();
  await expect(resultValue(page, '2.5')).toBeVisible();
  await data.fill('1,5, 2,5');
  await page.getByRole('button', { name: 'Calcular estadística' }).click();
  const choice = page.getByRole('group', { name: /No sé si la coma separa datos o es decimal/ });
  await expect(choice).toBeVisible();
  await expect(choice.getByRole('button').first()).toBeFocused();
  await choice.getByRole('button', { name: /^2 datos con coma decimal/ }).click();
  await expect(data).toHaveValue('1,5; 2,5');
  await expect(data).toBeFocused();
  await data.fill('1; 2; tres');
  await page.getByRole('button', { name: 'Calcular estadística' }).click();
  await expect(data).toHaveAttribute('aria-invalid', 'true');
  await expect(data).toBeFocused();
  await expect(page.getByText(/El dato 3, «tres»/)).toBeVisible();
});

test('matrices aceptan fracciones, señalan celdas y tamaños inválidos y se pueden pegar', async ({
  page,
}) => {
  await openTool(page, 'Matrices');
  const cell = (row: number, column: number) =>
    page.getByRole('textbox', { name: `Matriz A, fila ${row}, columna ${column}`, exact: true });
  const calculateMatrix = () => page.getByRole('button', { name: 'Calcular matriz' }).click();
  await cell(1, 1).fill('1/2');
  await calculateMatrix();
  await expect(resultValue(page, '-4')).toBeVisible();
  await cell(1, 2).fill('dos');
  await calculateMatrix();
  await expect(cell(1, 2)).toBeFocused();
  await expect(cell(1, 2)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/^A, fila 1, columna 2:/)).toBeVisible();
  await cell(1, 2).fill('2');
  await page.getByLabel('Columnas de A').selectOption('3');
  await calculateMatrix();
  await expect(page.getByRole('alert').filter({ hasText: 'una matriz cuadrada' })).toBeVisible();
  await expect(page.getByLabel('Columnas de A')).toBeFocused();
  await page.getByRole('button', { name: 'Escribir o pegar la matriz A' }).click();
  await page.getByLabel('Matriz A como texto').fill('1 2\n3 4');
  await page.getByRole('button', { name: 'Usar esta matriz' }).click();
  await expect(page.getByLabel('Columnas de A')).toHaveValue('2');
  await expect(cell(2, 2)).toHaveValue('4');
  await expect(cell(1, 1)).toBeFocused();
});
