import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openTool } from './navigation';

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
  await expect(page.getByLabel('Resultado: 56', { exact: true })).toBeVisible();
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
  const chooser = page.getByRole('combobox', { name: 'Elegir herramienta', exact: true });
  await expect(chooser).toBeFocused();
  await chooser.selectOption({ label: 'Matrices' });
  await expect(expression).toBeVisible();
  await expect(chooser).toBeFocused();
  await chooser.press('Tab');
  await expect(page.getByRole('button', { name: 'Abrir herramienta' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Herramienta actual: Matrices' })).toBeFocused();
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
  const cell = page.getByRole('spinbutton', {
    name: 'Matriz A, fila 1, columna 1, valor 1',
    exact: true,
  });
  await cell.fill('9');
  await openTool(page, 'Álgebra y cálculo');
  await expect(body).toHaveValue('x^2=25');
  await page.getByRole('button', { name: 'Calcular operación' }).click();
  await expect(page.getByRole('region', { name: 'Resultado', exact: true })).toContainText('x = 5');
  await page.keyboard.press('Alt+Shift+r');
  await expect(page.getByRole('heading', { name: 'Resultado', exact: true })).toBeFocused();
  await openTool(page, 'Matrices');
  await expect(
    page.getByRole('spinbutton', { name: 'Matriz A, fila 1, columna 1, valor 9', exact: true }),
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
  await expect(page.getByLabel('Resultado: 5', { exact: true })).toBeVisible();
  await page.keyboard.press('Alt+Shift+h');
  await expect(page.locator('#history-title')).toBeFocused();
  await expect(expression).toBeHidden();
  await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  await page.getByRole('button', { name: 'Editar cálculo 2+3' }).click();
  await expect(expression).toBeFocused();
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  const theme = page.getByRole('combobox', { name: 'Tema', exact: true });
  await expect(page.locator('#settings-title')).toBeFocused();
  await theme.focus();
  await theme.press('F1');
  await expect(page.locator('#help-title')).toBeFocused();
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
  await expect(page.getByRole('button', { name: 'Explorar gráfico', exact: true })).toBeVisible();
});
