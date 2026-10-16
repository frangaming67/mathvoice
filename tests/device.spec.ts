import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pressKey, resultValue } from './navigation';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla', exact: true }).click();
});
const expression = (page: Page) => page.getByLabel('Expresión matemática', { exact: true });
const status = (page: Page) => page.getByRole('status');
const keys = (page: Page) => page.getByRole('group', { name: 'Teclado de la calculadora' });
async function calculate(page: Page, text: string) {
  await expression(page).fill(text);
  await expression(page).press('Enter');
}

test('se usa como una calculadora de mano: plantillas, Shift, Alpha y Ans', async ({ page }) => {
  await pressKey(page, 'Raíz cuadrada');
  await expect(expression(page)).toHaveValue('sqrt()');
  for (const key of ['Uno', 'Seis']) await pressKey(page, key);
  await expect(expression(page)).toHaveValue('sqrt(16)');
  await pressKey(page, 'Igual, calcular');
  await expect(resultValue(page, '4')).toBeVisible();
  await expect(page.locator('.lcd-answer')).toContainText('4');
  // Un operador después del resultado sigue con Ans.
  await pressKey(page, 'Elevar al cuadrado');
  await expect(expression(page)).toHaveValue('ans^2');
  await pressKey(page, 'Igual, calcular');
  await expect(resultValue(page, '16')).toBeVisible();
  // Shift cambia el nombre de las teclas y se apaga después de una.
  await keys(page).getByRole('button', { name: 'Shift', exact: true }).click();
  await expect(keys(page).getByRole('button', { name: 'Shift', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(status(page)).toContainText('Shift activado');
  await keys(page).getByRole('button', { name: 'Arco seno', exact: true }).click();
  await expect(expression(page)).toHaveValue('asin()');
  await expect(keys(page).getByRole('button', { name: 'Seno', exact: true })).toBeVisible();
  await pressKey(page, 'Borrar toda la expresión');
  await pressKey(page, 'Variable A', 'Alpha');
  await expect(expression(page)).toHaveValue('A');
});

test('S⇔D, ENG, FACT y °′″ cambian cómo se muestra el resultado', async ({ page }) => {
  await calculate(page, '1/3+1/6');
  await expect(resultValue(page, '1/2')).toBeVisible();
  await pressKey(page, 'Cambiar entre fracción y decimal');
  await expect(page.locator('.lcd-answer')).toContainText('0.5');
  await expect(status(page)).toContainText('Decimal');
  await calculate(page, '12345');
  await expect(resultValue(page, '12345')).toBeVisible();
  await pressKey(page, 'Notación de ingeniería');
  await expect(page.locator('.lcd-answer')).toContainText('12.345');
  await expect(status(page)).toContainText('Notación de ingeniería');
  await calculate(page, '360');
  await pressKey(page, 'Descomponer en factores primos', 'Shift');
  await expect(status(page)).toContainText('Factores primos');
  await calculate(page, '12.5125');
  await pressKey(page, 'Grados, minutos y segundos');
  await expect(status(page)).toContainText('12 grados 30 minutos 45 segundos');
  // Con la expresión a medio escribir, la misma tecla escribe los grados.
  await expression(page).fill('30');
  await pressKey(page, 'Grados, minutos y segundos');
  await expect(expression(page)).toHaveValue('30°');
});

test('STO, RECALL, MENU y CONST como en la calculadora de mano', async ({ page }) => {
  await calculate(page, '6*7');
  await expect(resultValue(page, '42')).toBeVisible();
  await pressKey(page, 'Guardar el resultado en una variable');
  await expect(status(page)).toContainText('STO');
  // Con STO pendiente, la tecla de la variable guarda sin Alpha.
  await pressKey(page, 'Variable A');
  await expect(resultValue(page, '42')).toBeVisible();
  await calculate(page, 'A+1');
  await expect(resultValue(page, '43')).toBeVisible();
  await pressKey(page, 'Ver las variables guardadas', 'Shift');
  await expect(page.getByRole('menuitem', { name: '1: A, = 42', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await pressKey(page, 'Menú de modos');
  const menu = page.getByRole('menu', { name: 'Menú de modos' });
  await expect(menu.getByRole('menuitem', { name: '1: Calcular', exact: true })).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(menu.getByRole('menuitem', { name: '4: Matriz', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Matrices', exact: true, level: 1 }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Calculadora', exact: true }).click();
  await expression(page).fill('');
  await pressKey(page, 'Constantes físicas', 'Shift');
  await page.keyboard.press('Enter');
  await expect(expression(page)).toHaveValue('c_luz');
});

test('teclas que piden datos: integral, derivada, sumatoria, CALC y SOLVE', async ({ page }) => {
  await pressKey(page, 'Integral definida');
  const integral = page.getByRole('dialog', { name: 'Integral definida' });
  await integral.getByLabel('Función de x').fill('x^2');
  await integral.getByLabel('Desde x igual a').fill('0');
  await integral.getByLabel('Hasta x igual a').fill('3');
  await integral.getByRole('button', { name: 'Calcular integral' }).click();
  await expect(resultValue(page, '9')).toBeVisible();
  await expect(page.locator('.lcd-natural')).toContainText('∫');
  await pressKey(page, 'Derivada en un punto', 'Shift');
  const derivative = page.getByRole('dialog', { name: 'Derivada' });
  await derivative.getByLabel('Función de x').fill('x^3');
  await derivative.getByLabel('En x igual a (opcional)').fill('2');
  await derivative.getByRole('button', { name: 'Calcular derivada' }).click();
  await expect(resultValue(page, '12')).toBeVisible();
  await pressKey(page, 'Sumatoria', 'Shift');
  const sum = page.getByRole('dialog', { name: 'Sumatoria' });
  await sum.getByLabel('Término en x').fill('x^2');
  await sum.getByLabel('Desde x igual a').fill('1');
  await sum.getByLabel('Hasta x igual a').fill('10');
  await sum.getByRole('button', { name: 'Calcular sumatoria' }).click();
  await expect(resultValue(page, '385')).toBeVisible();
  await expression(page).fill('3x+1');
  await pressKey(page, 'Calcular con valores para las variables');
  const calc = page.getByRole('dialog', { name: 'CALC: valores de las variables' });
  await calc.getByLabel('Valor de x').fill('2');
  await calc.getByRole('button', { name: 'Calcular' }).click();
  await expect(resultValue(page, '7')).toBeVisible();
  await expression(page).fill('x^2-4');
  await pressKey(page, 'Resolver la ecuación', 'Shift');
  await expect(page.getByRole('region', { name: 'Resultado', exact: true })).toContainText(
    'x = -2',
  );
});

test('la cruceta trae cálculos anteriores y mueve el cursor; OFF apaga la pantalla', async ({
  page,
}) => {
  await calculate(page, '1+1');
  await expect(resultValue(page, '2')).toBeVisible();
  await calculate(page, '2+5');
  await expect(resultValue(page, '7')).toBeVisible();
  await pressKey(page, 'Cálculo anterior');
  await expect(expression(page)).toHaveValue('2+5');
  await pressKey(page, 'Cálculo anterior');
  await expect(expression(page)).toHaveValue('1+1');
  await expect(status(page)).toContainText('Cálculo 2 de 2');
  await pressKey(page, 'Cálculo siguiente');
  await expect(expression(page)).toHaveValue('2+5');
  await expression(page).evaluate((field: HTMLInputElement) => field.setSelectionRange(3, 3));
  await pressKey(page, 'Cursor a la izquierda');
  await pressKey(page, 'Cursor a la izquierda');
  await expect(status(page)).toHaveText('más');
  await pressKey(page, 'Apagar la pantalla', 'Shift');
  await expect(page.locator('.lcd')).toHaveAttribute('data-off', 'true');
  await pressKey(page, 'Siete');
  await expect(expression(page)).toHaveValue('2+5');
  await pressKey(page, 'Encender');
  await expect(page.locator('.lcd')).not.toHaveAttribute('data-off');
  // El 7 entra donde quedó el cursor, después del primer 2.
  await pressKey(page, 'Siete');
  await expect(expression(page)).toHaveValue('27+5');
});

test('el teclado es una sola parada de Tab, se recorre con flechas y pasa axe', async ({
  page,
}) => {
  await expect(page.locator('.calc-keys button[tabindex="0"]')).toHaveCount(1);
  const seven = keys(page).getByRole('button', { name: 'Siete', exact: true });
  await seven.focus();
  await page.keyboard.press('ArrowRight');
  await expect(keys(page).getByRole('button', { name: 'Ocho', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(keys(page).getByRole('button', { name: 'Cinco', exact: true })).toBeFocused();
  // Con el foco en el teclado, escribir números también los marca.
  await page.keyboard.press('9');
  await expect(expression(page)).toHaveValue('9');
  const results = await new AxeBuilder({ page }).include('.device-layout').analyze();
  expect(results.violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('MENU abre los modos Tabla y Proporción, como en la calculadora de mano', async ({ page }) => {
  await pressKey(page, 'Menú de modos');
  await page.keyboard.press('9');
  await expect(page.getByRole('heading', { name: 'Tabla de valores', level: 1 })).toBeVisible();
  await page.getByLabel('g(x) = (opcional)').fill('1/x');
  await page.getByRole('button', { name: 'Calcular tabla' }).click();
  const table = page.getByRole('table', { name: 'Tabla de valores' });
  await expect(table.getByRole('columnheader')).toHaveText(['x', 'f(x)', 'g(x)']);
  await expect(table.getByRole('rowheader')).toHaveText(['-3', '-2', '-1', '0', '1', '2', '3']);
  await expect(table.getByRole('row').nth(4).getByRole('cell')).toHaveText(['0', 'No definida']);
  await expect(status(page)).toContainText('Tabla de valores de 7 filas');
  await page.getByRole('link', { name: 'Calculadora', exact: true }).click();
  await pressKey(page, 'Menú de modos');
  await page.keyboard.press('B');
  await expect(page.getByRole('heading', { name: 'Proporciones', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Calcular X' }).click();
  await expect(page.getByRole('region', { name: 'Resultado', exact: true })).toContainText('X = 6');
});
