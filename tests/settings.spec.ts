import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openTool, resultValue } from './navigation';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla', exact: true }).click();
});

async function choose(page: Page, name: string, value: string) {
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await page.getByRole('combobox', { name, exact: true }).selectOption(value);
  await page.getByRole('link', { name: 'Calculadora', exact: true }).click();
}
async function openKeypad(page: Page) {
  await page.locator('#keypad-panel').evaluate((panel: HTMLDetailsElement) => (panel.open = true));
}
async function calculate(page: Page, text: string) {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill(text);
  await expression.press('Enter');
}

test('la coma decimal llega al cálculo, al teclado, a la memoria y a «ans»', async ({ page }) => {
  await choose(page, 'Separador decimal', 'coma');
  await calculate(page, '2,5+1');
  await expect(resultValue(page, '3,5')).toBeVisible();
  await calculate(page, 'ans*2');
  await expect(resultValue(page, '7')).toBeVisible();
  await calculate(page, 'log(8; 2)');
  await expect(resultValue(page, '3')).toBeVisible();
  // El teclado en pantalla escribe la coma y la memoria se muestra con coma.
  await openKeypad(page);
  await expect(page.getByRole('button', { name: 'Coma decimal', exact: true })).toHaveText(',');
  await calculate(page, '1,5');
  await page.getByRole('button', { name: 'Sumar resultado a memoria', exact: true }).click();
  await expect(page.getByText('M: 1,5')).toBeVisible();
  // Al volver al punto, la memoria y el último resultado se reutilizan sin errores.
  await choose(page, 'Separador decimal', 'punto');
  await openKeypad(page);
  await expect(page.getByText('M: 1.5')).toBeVisible();
  await page.getByLabel('Expresión matemática', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Recuperar memoria', exact: true }).click();
  await expect(page.getByLabel('Expresión matemática', { exact: true })).toHaveValue('(1.5)');
  await calculate(page, 'ans+1');
  await expect(resultValue(page, '2.5')).toBeVisible();
});

test('con coma decimal, las herramientas no confunden argumentos con decimales', async ({
  page,
}) => {
  await choose(page, 'Separador decimal', 'coma');
  // «integrate(2*x, x, 0, 1)»: sin el espacio, «0,1» se leería como un decimal.
  await openTool(page, 'Álgebra y cálculo');
  await page
    .getByRole('combobox', { name: 'Operación simbólica', exact: true })
    .selectOption('integrate');
  await page.getByLabel('Función o ecuación', { exact: true }).fill('2*x');
  await page.getByRole('checkbox', { name: /definida/i }).check();
  await page.getByLabel('Desde', { exact: true }).fill('0');
  await page.getByLabel('Hasta', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Calcular operación', exact: true }).click();
  await expect(resultValue(page, '1')).toBeVisible();
  await openTool(page, 'Estadística');
  await page
    .getByRole('combobox', { name: 'Análisis estadístico', exact: true })
    .selectOption('mean');
  await page.getByRole('textbox', { name: 'Datos X', exact: true }).fill('1; 2; 3');
  await page.getByRole('button', { name: 'Calcular estadística', exact: true }).click();
  await expect(resultValue(page, '2')).toBeVisible();
  await openTool(page, 'Matrices');
  await page.getByRole('button', { name: 'Calcular matriz', exact: true }).click();
  await expect(resultValue(page, '-2')).toBeVisible();
  await openTool(page, 'Conversores');
  await page.getByLabel('Número entero', { exact: true }).fill('FF');
  await page.getByRole('combobox', { name: 'Base de origen', exact: true }).selectOption('16');
  await page.getByRole('combobox', { name: 'Base de destino', exact: true }).selectOption('10');
  await page.getByRole('button', { name: 'Convertir base', exact: true }).click();
  await expect(resultValue(page, '255')).toBeVisible();
  // La paleta inserta las funciones con «;» entre argumentos, como escribe el usuario.
  await page.getByRole('link', { name: 'Calculadora', exact: true }).click();
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill('');
  await page.keyboard.press('Alt+Shift+p');
  await page.getByRole('combobox', { name: 'Buscar comando' }).fill('raiz de indice');
  await page.getByRole('combobox', { name: 'Buscar comando' }).press('Enter');
  await page.getByLabel('Radicando', { exact: true }).fill('15,625');
  await page.getByLabel('Índice', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Insertar en expresión', exact: true }).click();
  await expect(expression).toHaveValue('nthRoot(15,625;3)');
  await expression.press('Enter');
  await expect(resultValue(page, '2,5')).toBeVisible();
});

test('forma del resultado, formato fijo y modo complejo cambian el cálculo', async ({ page }) => {
  await calculate(page, '0.5+0.25');
  await expect(resultValue(page, '0.75')).toBeVisible();
  await choose(page, 'Forma del resultado', 'exacto');
  await calculate(page, '0.5+0.25');
  await expect(resultValue(page, '3/4')).toBeVisible();
  await calculate(page, 'sqrt(-4)');
  await expect(page.getByRole('alert')).toContainText('modo complejo');
  await choose(page, 'Modo de números', 'complejo');
  await calculate(page, 'sqrt(-4)');
  await expect(resultValue(page, '2i')).toBeVisible();
  await choose(page, 'Forma del resultado', 'decimal');
  await choose(page, 'Formato de los resultados', 'fijo');
  await choose(page, 'Cantidad de decimales', '2');
  await calculate(page, '1/3');
  await expect(resultValue(page, '0.33')).toBeVisible();
});

test('los deslizadores tienen nombre fijo y dicen su valor en palabras', async ({ page }) => {
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  const rate = page.getByRole('slider', { name: 'Velocidad', exact: true });
  await expect(rate).toHaveAttribute('aria-valuetext', '1 vez, normal');
  await rate.focus();
  await page.keyboard.press('ArrowRight');
  await expect(rate).toHaveAttribute('aria-valuetext', '1,1 veces');
  // El nombre no cambia con el valor: el lector no lo repite en cada paso.
  await expect(page.getByRole('slider', { name: 'Velocidad', exact: true })).toBeFocused();
  const sounds = page.getByRole('slider', { name: 'Volumen de los sonidos', exact: true });
  await expect(sounds).toHaveAttribute('aria-valuetext', '50 por ciento');
  await page.getByRole('checkbox', { name: 'Sonidos breves de confirmación' }).check();
  await sounds.focus();
  await page.keyboard.press('ArrowRight');
  await expect(sounds).toHaveAttribute('aria-valuetext', '60 por ciento');
  const saved = await page.evaluate(() => localStorage.getItem('mathvoice.v1.keyboard'));
  expect(JSON.parse(saved!)).toMatchObject({ sounds: true, soundVolume: 0.6 });
  const results = await new AxeBuilder({ page }).include('.settings').analyze();
  expect(results.violations).toEqual([]);
});

test('una preferencia dañada vuelve a su valor sin borrar las demás', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'mathvoice.v1.preferences',
      JSON.stringify({ welcomed: true, theme: 'neon', decimalSeparator: 'coma', fontSize: 24 }),
    ),
  );
  await page.reload();
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Separador decimal' })).toHaveValue('coma');
  await expect(page.getByRole('combobox', { name: 'Tema', exact: true })).toHaveValue('light');
  await expect(page.getByRole('slider', { name: 'Tamaño de texto', exact: true })).toHaveValue(
    '24',
  );
});
