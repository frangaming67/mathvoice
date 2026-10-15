import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openTool, resultValue } from './navigation';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla', exact: true }).click();
});

test('la lectura de atajos sigue el elemento actual y los controles no la interrumpen al enfocarse', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { messages: [] as SpeechSynthesisUtterance[], pauses: 0, resumes: 0 };
    Object.defineProperty(window, '__keyboardSpeech', { value: state });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [],
        speak: (utterance: SpeechSynthesisUtterance) => state.messages.push(utterance),
        cancel: () => {},
        pause: () => state.pauses++,
        resume: () => state.resumes++,
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });
  await page.reload();
  await page.getByRole('link', { name: /^Ayuda/ }).focus();
  await page.keyboard.press('Alt+Shift+k');
  await expect(page.getByRole('heading', { name: 'Teclado y atajos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Guía por voz', exact: true, pressed: false }).click();
  await page.getByRole('button', { name: 'Escuchar atajos', exact: true }).click();
  const snapshot = () =>
    page.evaluate(() => {
      const state = (
        window as unknown as {
          __keyboardSpeech: {
            messages: SpeechSynthesisUtterance[];
            pauses: number;
            resumes: number;
          };
        }
      ).__keyboardSpeech;
      return {
        messages: state.messages.map((message) => message.text),
        pauses: state.pauses,
        resumes: state.resumes,
      };
    });
  const initial = await snapshot();
  expect(initial.messages.at(-1)).toContain('Ayuda');
  await page.getByRole('button', { name: 'Pausar lectura de atajos', exact: true }).focus();
  await page.waitForTimeout(250);
  expect((await snapshot()).messages).toEqual(initial.messages);
  await page.keyboard.press('Enter');
  expect((await snapshot()).pauses).toBe(1);
  await page.evaluate(() => {
    const state = (
      window as unknown as { __keyboardSpeech: { messages: SpeechSynthesisUtterance[] } }
    ).__keyboardSpeech;
    const utterance = state.messages.at(-1)!;
    utterance.onend?.call(utterance, new Event('end') as SpeechSynthesisEvent);
  });
  expect((await snapshot()).messages).toEqual(initial.messages);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  expect((await snapshot()).messages).toHaveLength(initial.messages.length + 1);
  await page.getByRole('button', { name: 'Atajo anterior', exact: true }).click();
  expect((await snapshot()).messages.at(-1)).toBe(initial.messages.at(-1));
  await page.getByRole('button', { name: 'Atajo siguiente', exact: true }).click();
  expect((await snapshot()).messages.at(-1)).not.toBe(initial.messages.at(-1));
  await page.keyboard.press('Escape');
});
test('modo matemático calcula, deshace y conserva escritura nativa dentro del campo', async ({
  page,
}) => {
  await page.keyboard.press('F2');
  const area = page.getByRole('group', { name: 'Área del teclado matemático', exact: true });
  await expect(area).toBeFocused();
  await page.keyboard.type('2+3');
  await page.keyboard.press('Enter');
  await expect(resultValue(page, '5')).toBeVisible();
  await expect(area).toBeFocused();
  await page.keyboard.press('Control+z');
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expect(expression).toHaveValue('2+');
  await page.keyboard.press('Control+y');
  await expect(expression).toHaveValue('2+3');
  await expression.fill('');
  await expression.pressSequentially('sin(x)+2');
  await expect(expression).toHaveValue('sin(x)+2');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('F2');
  await expect(expression).toBeFocused();
  await expect(area).toHaveCount(0);
});
test('paleta tolera acentos y abre el mismo formulario sin destruir el borrador básico', async ({
  page,
}) => {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill('7*8');
  await page.keyboard.press('Alt+Shift+p');
  const search = page.getByRole('combobox', { name: 'Buscar comando' });
  await search.fill('derivada');
  await search.press('Enter');
  const body = page.getByLabel('Función o ecuación', { exact: true });
  await expect(body).toBeFocused();
  await body.fill('x^3');
  await body.press('Enter');
  await expect(page.getByRole('region', { name: 'Resultado', exact: true })).toContainText('3*x^2');
  await page.keyboard.press('Alt+Shift+c');
  await expect(expression).toHaveValue('7*8');
  await page.keyboard.press('Alt+Shift+p');
  await search.fill('raiz cuadrada');
  await expect(
    page.getByRole('listbox', { name: 'Comandos encontrados' }).getByRole('option'),
  ).toHaveCount(1);
  await search.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Raíz cuadrada', exact: true })).toBeVisible();
  await page.getByLabel('Radicando', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Cancelar función' }).click();
  await expect(expression).toHaveValue('7*8');
});
test('atajo científico pide datos y no calcula hasta confirmar la expresión', async ({ page }) => {
  await page.keyboard.press('F2');
  await page.keyboard.press('r');
  await expect(page.getByLabel('Radicando', { exact: true })).toBeFocused();
  await page.getByLabel('Radicando', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Insertar en expresión', exact: true }).click();
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expect(expression).toBeFocused();
  await expect(resultValue(page, '5')).toHaveCount(0);
  await expression.press('Enter');
  await expect(resultValue(page, '5')).toBeVisible();
});

test('los comandos de límites conservan el lado pedido y distinguen el bilateral', async ({
  page,
}) => {
  for (const [name, side, expected] of [
    ['Límite por izquierda', 'left', '-Infinity'],
    ['Límite por derecha', 'right', 'Infinity'],
  ]) {
    await page.keyboard.press('Alt+Shift+p');
    const search = page.getByRole('combobox', { name: 'Buscar comando' });
    await search.fill(name);
    await search.press('Enter');
    await expect(
      page.getByRole('combobox', { name: 'Sentido del límite', exact: true }),
    ).toHaveValue(side);
    const body = page.getByLabel('Función o ecuación', { exact: true });
    await expect(body).toBeFocused();
    await body.fill('1/x');
    await body.press('Enter');
    await expect(resultValue(page, String(expected))).toBeVisible();
  }
  await page
    .getByRole('combobox', { name: 'Sentido del límite', exact: true })
    .selectOption('both');
  await page.getByRole('button', { name: 'Calcular operación', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('bilateral');
});

test('edición simbólica respeta selección, Delete, Backspace y deshacer sin perder foco', async ({
  page,
}) => {
  await openTool(page, 'Álgebra y cálculo');
  const body = page.getByLabel('Función o ecuación', { exact: true });
  await body.fill('12345');
  await body.evaluate((element: HTMLInputElement) => element.setSelectionRange(1, 3));
  await page.keyboard.press('F2');
  const area = page.getByRole('group', { name: 'Área del teclado matemático', exact: true });
  await expect(area).toBeFocused();
  await page.keyboard.press('9');
  await expect(body).toHaveValue('1945');
  await page.keyboard.press('Delete');
  await expect(body).toHaveValue('195');
  await page.keyboard.press('Backspace');
  await expect(body).toHaveValue('15');
  await page.keyboard.press('Control+z');
  await expect(body).toHaveValue('195');
  await page.keyboard.press('Control+y');
  await expect(body).toHaveValue('15');
  await expect(area).toBeFocused();
});

test('paleta y captura de atajos respetan modificadores del lector y del navegador', async ({
  page,
}) => {
  await page.keyboard.press('Alt+Shift+p');
  const search = page.getByRole('combobox', { name: 'Buscar comando' });
  await search.fill('raíz cuadrada');
  await search.press('Control+Enter');
  await expect(search).toBeVisible();
  await page.keyboard.down('Insert');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Insert');
  await expect(search).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+Shift+k');
  await page.getByLabel('Buscar función', { exact: true }).fill('Raíz cuadrada');
  await page
    .getByRole('combobox', { name: 'Función elegida', exact: true })
    .selectOption({ label: 'Raíz cuadrada · R' });
  await page.getByRole('button', { name: 'Cambiar atajo de Raíz cuadrada', exact: true }).click();
  const capture = page.getByRole('button', { name: 'Presioná aquí la nueva combinación' });
  await capture.focus();
  await page.keyboard.down('CapsLock');
  await page.keyboard.press('d');
  await page.keyboard.up('CapsLock');
  await expect(page.getByLabel('Nueva combinación', { exact: true })).toHaveValue('R');
  await page.keyboard.press('F8');
  await expect(page.getByLabel('Nueva combinación', { exact: true })).toHaveValue('R');
  await expect(page.locator('#shortcut-error')).toContainText('reservada');
  await page.keyboard.press('Escape');
});

test('borrar en los extremos no deja un cursor pendiente sobre la escritura nativa', async ({
  page,
}) => {
  await openTool(page, 'Álgebra y cálculo');
  const body = page.getByLabel('Función o ecuación', { exact: true });
  for (const [boundary, erase, destination, inserted, expected] of [
    ['Home', 'Backspace', 'End', '+1', 'x^3+1'],
    ['End', 'Delete', 'Home', '2*', '2*x^3'],
  ]) {
    await body.fill('x^3');
    await body.press(boundary);
    await page.keyboard.press('F2');
    await expect(
      page.getByRole('group', { name: 'Área del teclado matemático', exact: true }),
    ).toBeFocused();
    await page.keyboard.press(erase);
    await expect(body).toHaveValue('x^3');
    await page.keyboard.press('F2');
    await body.focus();
    await body.press(destination);
    await body.pressSequentially(inserted);
    await expect(body).toHaveValue(expected);
  }
});
test('secuencia de herramienta y teclas de matriz conservan celdas y foco', async ({ page }) => {
  await page.keyboard.press('F2');
  await page.keyboard.press('g');
  await expect(page.getByRole('status')).toContainText('Comando Ir a');
  await page.keyboard.press('m');
  await expect(
    page.getByRole('heading', { name: 'Matrices', exact: true, level: 1 }),
  ).toBeFocused();
  const cells = page.locator('.matrix-editor input');
  await cells.first().fill('9');
  await cells.first().press('Control+End');
  await expect(cells.last()).toBeFocused();
  await cells.last().press('Home');
  await expect(cells.nth(2)).toBeFocused();
  await cells.nth(2).press('End');
  await expect(cells.last()).toBeFocused();
  await cells.last().press('Control+Home');
  await expect(cells.first()).toBeFocused();
  await expect(cells.first()).toHaveValue('9');
  await page.getByRole('group', { name: 'Área del teclado matemático', exact: true }).focus();
  await page.keyboard.press('i');
  await expect(
    page.getByRole('combobox', { name: 'Operación matricial', exact: true }),
  ).toHaveValue('inv');
  await expect(cells.first()).toBeFocused();
  await expect(cells.first()).toHaveValue('9');
});
test('modificadores del lector conservan celdas y coordenadas aunque el foco cambie', async ({
  page,
}) => {
  await openTool(page, 'Matrices');
  const cells = page.locator('.matrix-editor input');
  for (const modifier of ['Insert', 'CapsLock']) {
    await page.getByRole('heading', { name: 'Matrices', exact: true, level: 1 }).focus();
    await page.keyboard.down(modifier);
    await cells.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(cells.first()).toBeFocused();
    await page.keyboard.up(modifier);
    await page.keyboard.press('ArrowRight');
    await expect(cells.nth(1)).toBeFocused();
  }
  await openTool(page, 'Gráficos');
  await page.getByRole('button', { name: 'Graficar funciones', exact: true }).click();
  const explorer = page.getByRole('button', { name: 'Explorar gráfico', exact: true });
  await explorer.focus();
  const before = await page.locator('.coordinates').textContent();
  await page.keyboard.down('Insert');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.coordinates')).toHaveText(before!);
  await page.keyboard.up('Insert');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.coordinates')).not.toHaveText(before!);
});
test('práctica e identificación describen sin cambiar expresión ni ejecutar funciones', async ({
  page,
}) => {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill('12+3');
  await page.keyboard.press('Alt+Shift+k');
  await page
    .getByRole('combobox', { name: 'Categoría de atajos', exact: true })
    .selectOption('Cálculo');
  await page.getByRole('button', { name: 'Practicar teclado', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Área de práctica de teclado' })).toBeFocused();
  await page.keyboard.press('d');
  await expect(page.getByRole('status')).toContainText('Derivada');
  await expect(expression).toHaveValue('12+3');
  await page.keyboard.press('F2');
  await page.keyboard.press('Escape');
  await expect(page.locator('#keyboard-title')).toBeFocused();
  // F2 durante la práctica se describe, no cambia de modo.
  await expect(
    page.getByRole('button', { name: 'Activar modo matemático', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Identificar tecla', exact: true }).click();
  await page.keyboard.press('Shift+d');
  await expect(page.getByRole('status')).toContainText('Derivada de orden superior');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+Shift+c');
  await expect(expression).toHaveValue('12+3');
});
test('personalización rechaza conflicto, persiste, exporta e importa sin aceptar un mapa inválido', async ({
  page,
}) => {
  await page.keyboard.press('Alt+Shift+k');
  await page.getByLabel('Buscar función', { exact: true }).fill('raíz cuadrada');
  await page
    .getByRole('combobox', { name: 'Función elegida', exact: true })
    .selectOption({ label: 'Raíz cuadrada · R' });
  await page.getByRole('button', { name: 'Cambiar atajo de Raíz cuadrada', exact: true }).click();
  await page.getByLabel('Nueva combinación', { exact: true }).fill('D');
  await page.getByRole('button', { name: 'Guardar atajo', exact: true }).click();
  await expect(page.locator('#shortcut-error')).toContainText('asignado a Derivada');
  await page.getByLabel('Nueva combinación', { exact: true }).fill('Ctrl+L');
  await page.getByRole('button', { name: 'Guardar atajo', exact: true }).click();
  await expect(page.locator('#shortcut-error')).toContainText('reservado');
  await page.getByLabel('Nueva combinación', { exact: true }).fill('Shift+1');
  await page.getByRole('button', { name: 'Guardar atajo', exact: true }).click();
  await expect(page.locator('#shortcut-error')).toContainText('carácter');
  await page.getByLabel('Nueva combinación', { exact: true }).fill('; Q');
  await page.getByRole('button', { name: 'Guardar atajo', exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('mathvoice.v1.keyboard'));
  expect(JSON.parse(saved!).overrides.sqrt).toBe('; Q');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar atajos JSON', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('mathvoice-teclado.json');
  await page.getByLabel('Importar atajos JSON', { exact: true }).setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...JSON.parse(saved!), overrides: { sqrt: 'Ctrl+L' } })),
  });
  await expect(page.getByRole('status')).toContainText('No se importó');
  expect(await page.evaluate(() => localStorage.getItem('mathvoice.v1.keyboard'))).toBe(saved);
  await page.reload();
  await expect(page.getByLabel('Expresión matemática', { exact: true })).toBeFocused();
  await page.keyboard.press('F2');
  await expect(page.getByRole('group', { name: 'Área del teclado matemático' })).toBeFocused();
  await page.keyboard.press(';');
  await page.keyboard.press('q');
  await expect(page.getByRole('dialog', { name: 'Raíz cuadrada', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+Shift+k');
  await page.getByRole('button', { name: 'Restaurar atajos predeterminados', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar restauración', exact: true }).click();
  expect(
    JSON.parse((await page.evaluate(() => localStorage.getItem('mathvoice.v1.keyboard')))!)
      .overrides.sqrt,
  ).toBe('; Q');
  await page.getByRole('button', { name: 'Restaurar atajos predeterminados', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar restauración', exact: true }).click();
  expect(
    JSON.parse((await page.evaluate(() => localStorage.getItem('mathvoice.v1.keyboard')))!)
      .overrides,
  ).toEqual({});
});
test('comandos contextuales abren media, factorial, conversión y complejos sin calcular solos', async ({
  page,
}) => {
  await page.keyboard.press('F2');
  await openTool(page, 'Estadística');
  await page.getByRole('group', { name: 'Área del teclado matemático', exact: true }).focus();
  await page.keyboard.press('m');
  await expect(
    page.getByRole('combobox', { name: 'Análisis estadístico', exact: true }),
  ).toHaveValue('mean');
  await expect(
    page.getByRole('textbox', { name: 'Datos X', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Calcular estadística', exact: true }).click();
  await expect(resultValue(page, '3')).toBeVisible();
  await openTool(page, 'Probabilidad');
  await page.getByRole('group', { name: 'Área del teclado matemático', exact: true }).focus();
  await page.keyboard.press('f');
  await expect(page.getByLabel('Entero no negativo', { exact: true })).toBeFocused();
  await openTool(page, 'Conversores');
  await page.getByRole('group', { name: 'Área del teclado matemático', exact: true }).focus();
  await page.keyboard.press('t');
  await expect(
    page.getByRole('combobox', { name: 'Categoría de unidades', exact: true }),
  ).toHaveValue('Temperatura');
  await expect(page.getByLabel('Valor a convertir', { exact: true })).toBeFocused();
  await openTool(page, 'Vectores y complejos');
  await page.getByLabel('Número complejo', { exact: true }).focus();
  await page.getByRole('group', { name: 'Área del teclado matemático', exact: true }).focus();
  await page.keyboard.press('c');
  await expect(page.getByRole('combobox', { name: 'Operación compleja', exact: true })).toHaveValue(
    'conj',
  );
  await expect(page.getByLabel('Número complejo', { exact: true })).toBeFocused();
});
test('paleta y referencia pasan axe, reflow y búsqueda inversa', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.keyboard.press('Alt+Shift+k');
  await page.getByLabel('Buscar tecla', { exact: true }).fill('Shift+D');
  await expect(
    page.getByRole('row', { name: /^Derivada de orden superior Shift\+D/ }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Función elegida', exact: true })).toHaveValue(
    /.+/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.keyboard.press('Alt+Shift+p');
  await page.getByRole('combobox', { name: 'Buscar comando' }).fill('determinante');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Buscar tecla', { exact: true })).toBeFocused();
});

test('gráfico por comandos: coordenadas, paso, evento, pausa, continuación, velocidad y Escape', async ({
  page,
}) => {
  await openTool(page, 'Gráficos');
  await page
    .getByRole('textbox', { name: 'Funciones de x, una por línea (hasta 4)', exact: true })
    .fill('x^2');
  await page.getByRole('button', { name: 'Graficar funciones', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Explorar gráfico', exact: true })).toBeVisible();
  await page.keyboard.press('F2');
  await page.keyboard.press('Home');
  await expect(page.locator('.coordinates')).toContainText('Equis igual a -5');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('combobox', { name: 'Paso en X', exact: true })).toHaveValue('0.5');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.coordinates')).toContainText('Equis igual a -4.5');
  await page.keyboard.press('m');
  await expect(page.getByRole('status')).toContainText('mínimo local aproximado');
  await page.keyboard.press('s');
  await expect(
    page.getByRole('button', { name: 'Detener sonificación', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('button', { name: 'Continuar sonificación', exact: true }),
  ).toBeVisible();
  const pausedCoordinates = await page.locator('.coordinates').textContent();
  await page.waitForTimeout(300);
  await expect(page.locator('.coordinates')).toHaveText(pausedCoordinates!);
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('button', { name: 'Pausar sonificación', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.coordinates')).not.toHaveText(pausedCoordinates!);
  await page
    .getByRole('combobox', { name: 'Velocidad de sonificación', exact: true })
    .selectOption('2');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Sonificar recorrido', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Pausar sonificación', exact: true }),
  ).toBeDisabled();
});
