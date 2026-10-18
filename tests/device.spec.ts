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
  const table = page.getByRole('grid', { name: 'Tabla de valores' });
  await expect(table.getByRole('columnheader')).toHaveText(['x', 'f(x)', 'g(x)']);
  await expect(table.getByRole('rowheader')).toHaveText(['-3', '-2', '-1', '0', '1', '2', '3']);
  await expect(table.getByRole('row').nth(4).getByRole('gridcell')).toHaveText([
    '0',
    'No definida',
  ]);
  await expect(status(page)).toContainText('Tabla de valores de 7 filas');
  // Una sola parada de Tab; las flechas van de celda en celda y cada una se dice con su x.
  await expect(table.locator('[tabindex="0"]')).toHaveCount(1);
  await table.getByRole('gridcell', { name: '9' }).first().focus();
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight'])
    await page.keyboard.press(key);
  const focused = table.locator(':focus');
  await expect(focused).toHaveText('No definida');
  await expect(focused).toHaveAttribute(
    'data-speech',
    'g de equis en equis igual a 0: no definida',
  );
  await page.keyboard.press('Control+End');
  await expect(focused).toHaveText('0.3333333333');
  await page.keyboard.press('Home');
  await expect(focused).toHaveAttribute('data-speech', 'equis igual a 3, fila 7 de 7');
  const results = await new AxeBuilder({ page }).include('.value-table').analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('link', { name: 'Calculadora', exact: true }).click();
  await pressKey(page, 'Menú de modos');
  await page.keyboard.press('B');
  await expect(page.getByRole('heading', { name: 'Proporciones', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Calcular X' }).click();
  await expect(page.getByRole('region', { name: 'Resultado', exact: true })).toContainText('X = 6');
});

test('MENU 7, Distribución: la normal inversa da el x de un área', async ({ page }) => {
  await pressKey(page, 'Menú de modos');
  await page.keyboard.press('7');
  await expect(page.getByRole('heading', { name: 'Probabilidad', level: 1 })).toBeVisible();
  await page
    .getByLabel('Distribución u operación')
    .selectOption({ label: 'Normal inversa: x con P(X ≤ x) igual al área' });
  await expect(page.getByLabel('Área a la izquierda')).toHaveValue('0.975');
  await page.getByRole('button', { name: 'Calcular probabilidad' }).click();
  await expect(resultValue(page, '1.959963985')).toBeVisible();
});

test('MENU C, Hoja de cálculo: se escribe sobre la celda, fórmulas, rangos y copiar abajo', async ({
  page,
}) => {
  await pressKey(page, 'Menú de modos');
  await page.keyboard.press('C');
  await expect(page.getByRole('heading', { name: 'Hoja de cálculo', level: 1 })).toBeVisible();
  const sheet = page.getByRole('grid', { name: 'Hoja de cálculo' });
  const cell = (name: string) => sheet.locator(`[data-cell="${name}"]`);
  await expect(sheet.locator('[tabindex="0"]')).toHaveCount(1);
  await cell('A1').focus();
  // Escribir sobre la celda la edita en la línea de abajo; Enter guarda y baja.
  for (const value of ['1', '2', '3', 'suma(A1:A3)']) {
    await page.keyboard.type(value);
    await page.keyboard.press('Enter');
  }
  await expect(cell('A4')).toHaveText('6');
  await expect(cell('A5')).toBeFocused();
  await expect(status(page)).toContainText('A4: 6. Fórmula');
  await page.keyboard.press('ArrowUp');
  await expect(cell('A4')).toBeFocused();
  await expect(page.getByLabel('Contenido de A4')).toHaveValue('suma(A1:A3)');
  // B1 = A1*10, copiada hasta la fila 3: las referencias se corren de fila.
  await cell('B1').focus();
  await page.keyboard.type('A1*10');
  await page.keyboard.press('Enter');
  await cell('B1').focus();
  await page.getByLabel('Copiar B1 hacia abajo hasta la fila').fill('3');
  await page.getByRole('button', { name: 'Copiar hacia abajo' }).click();
  await expect(cell('B3')).toHaveText('30');
  await expect(cell('B3')).toHaveAttribute('data-speech', /^B3: 30\. Fórmula: /);
  // Un error se explica en la celda.
  await cell('C1').focus();
  await page.keyboard.type('1/0');
  await page.keyboard.press('Enter');
  await expect(cell('C1')).toHaveText('Error');
  await expect(cell('C1')).toHaveAttribute(
    'data-speech',
    'C1: error. No se puede dividir por cero. Fórmula: 1 sobre 0',
  );
  const results = await new AxeBuilder({ page }).include('.sheet').analyze();
  expect(results.violations).toEqual([]);
  // La hoja queda guardada en el navegador.
  await page.reload();
  await page.getByRole('link', { name: 'Calculadora', exact: true }).click();
  await pressKey(page, 'Menú de modos');
  await page.keyboard.press('C');
  await expect(cell('A4')).toHaveText('6');
});

test('en los temas de alto contraste cada tecla se lee sobre su propio fondo', async ({ page }) => {
  for (const theme of ['contrast', 'mono', 'yellow']) {
    await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
    // Contraste de la tinta de cada tecla contra el fondo que de verdad queda detrás de ella.
    const unreadable = await page.evaluate(() => {
      const rgb = (color: string) => (color.match(/[\d.]+/g) ?? []).map(Number);
      const channel = (value: number) => {
        const v = value / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const luminance = ([r, g, b]: number[]) =>
        0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      const behind = (element: Element | null): number[] => {
        for (let node = element; node; node = node.parentElement) {
          const color = rgb(getComputedStyle(node).backgroundColor);
          if (color.length < 4 || color[3] > 0) return color.slice(0, 3);
        }
        return [255, 255, 255];
      };
      return [...document.querySelectorAll<HTMLElement>('.calc-keys .calc-key')]
        .filter((key) => key.textContent?.trim() && parseFloat(getComputedStyle(key).fontSize) > 0)
        .map((key) => {
          const [a, b] = [luminance(rgb(getComputedStyle(key).color)), luminance(behind(key))];
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          return { key: key.getAttribute('aria-label'), ratio: Math.round(ratio * 10) / 10 };
        })
        .filter(({ ratio }) => ratio < 4.5);
    });
    expect(unreadable, theme).toEqual([]);
  }
});

test('las herramientas están dentro de la calculadora y el teclado escribe en ellas', async ({
  page,
}) => {
  await pressKey(page, 'Menú de modos');
  await page.keyboard.press('9');
  // Es la misma calculadora: el LCD dice el modo y la herramienta está en la pantalla.
  await expect(page.locator('.lcd-mode')).toHaveText('Tabla de valores');
  await expect(page.locator('.device-app').getByLabel('f(x) =')).toBeVisible();
  const f = page.getByLabel('f(x) =');
  await f.focus();
  await pressKey(page, 'Borrar toda la expresión');
  await expect(f).toHaveValue('');
  for (const key of ['Variable equis', 'Elevar al cuadrado']) await pressKey(page, key);
  await expect(f).toHaveValue('x^2');
  // ▼ pasa al campo siguiente; «=» calcula la herramienta.
  await pressKey(page, 'Cálculo siguiente');
  const g = page.getByLabel('g(x) = (opcional)');
  await expect(g).toBeFocused();
  for (const key of ['Dos', 'Multiplicar', 'Variable equis']) await pressKey(page, key);
  await expect(g).toHaveValue('2*x');
  await pressKey(page, 'Igual, calcular');
  const table = page.getByRole('grid', { name: 'Tabla de valores' });
  await expect(table.getByRole('row').nth(1).getByRole('gridcell')).toHaveText(['9', '-6']);
  // En un campo numérico, el punto decimal espera la cifra siguiente.
  await pressKey(page, 'Menú de modos');
  await page.keyboard.press('7');
  await page.getByLabel('Distribución u operación').selectOption({ label: 'Normal: P(X ≤ x)' });
  const x = page.getByLabel('x', { exact: true });
  await x.focus();
  await pressKey(page, 'Borrar toda la expresión');
  for (const key of ['Uno', 'Punto decimal', 'Nueve', 'Seis']) await pressKey(page, key);
  await expect(x).toHaveValue('1.96');
  await pressKey(page, 'Igual, calcular');
  await expect(resultValue(page, '0.9750021049')).toBeVisible();
  // Las teclas que solo tienen sentido en Calcular lo dicen.
  await pressKey(page, 'Resolver la ecuación', 'Shift');
  await expect(status(page)).toContainText('Esa tecla es del modo Calcular');
});

test('el explorador recorre la expresión por partes y lleva el cursor a la elegida', async ({
  page,
}) => {
  const field = expression(page);
  await field.fill('(x^2+1)/(2x-3)');
  await page.getByRole('button', { name: 'Explorar expresión', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Explorar la expresión' });
  await expect(dialog.getByRole('application', { name: 'Explorar la expresión' })).toBeFocused();
  // Con lector de pantalla, cada movimiento llega a la región de estado del diálogo.
  const said = dialog.getByRole('status');
  await expect(said).toContainText('Expresión completa, fracción');
  await page.keyboard.press('ArrowDown');
  await expect(said).toHaveText('Numerador, suma: equis al cuadrado más 1');
  await page.keyboard.press('ArrowRight');
  await expect(said).toHaveText('Denominador, resta: 2 equis menos 3');
  await page.keyboard.press('ArrowRight');
  await expect(said).toHaveText('Es la última parte.');
  await page.keyboard.press('r');
  await expect(said).toHaveText(
    'Resta de 2 partes: el término 1 es un producto y el término 2, un número.',
  );
  await page.keyboard.press('ArrowDown');
  await expect(said).toHaveText('Término 1, producto: 2 equis');
  await page.keyboard.press('p');
  await expect(said).toHaveText('Estás en el término 1, dentro del denominador.');
  // Enter cierra y deja elegida esa parte en el campo, lista para corregirla.
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(field).toBeFocused();
  expect(
    await field.evaluate((input: HTMLInputElement) =>
      input.value.slice(input.selectionStart!, input.selectionEnd!),
    ),
  ).toBe('2x');
  // El resultado también se explora; Escape vuelve a donde se estaba.
  await calculate(page, 'diff(x^3*sin(x), x)');
  await expect(page.getByRole('region', { name: 'Resultado', exact: true })).toContainText('cos');
  const button = page.getByRole('button', { name: 'Explorar resultado', exact: true });
  await button.click();
  const result = page.getByRole('dialog', { name: 'Explorar el resultado' });
  await expect(result.getByRole('status')).toContainText('Expresión completa, suma');
  await page.keyboard.press('Escape');
  await expect(result).toBeHidden();
  await expect(button).toBeFocused();
});

test('el explorador pasa axe', async ({ page }) => {
  await expression(page).fill('sqrt(x^2+1) - 3/4');
  await page.getByRole('button', { name: 'Explorar expresión', exact: true }).click();
  await page.keyboard.press('ArrowDown');
  const results = await new AxeBuilder({ page }).include('dialog.explorer').analyze();
  expect(results.violations).toEqual([]);
});
