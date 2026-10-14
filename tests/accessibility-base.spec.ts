import { expect, test } from '@playwright/test';
import { openTool } from './navigation';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    const controls = { pauses: 0, resumes: 0 };
    Object.defineProperty(window, '__spoken', { value: spoken });
    Object.defineProperty(window, '__speechControls', { value: controls });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [],
        speak: (u: SpeechSynthesisUtterance) => spoken.push(u.text),
        cancel() {},
        pause() {
          controls.pauses++;
        },
        resume() {
          controls.resumes++;
        },
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
test('Ctrl más Enter solicita lectura explícita sin calcular ni mover el foco', async ({
  page,
}) => {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill('2+3');
  await page.keyboard.press('Control+Enter');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.at(-1)))
    .toBe('2 más 3');
  await expect(expression).toBeFocused();
  await expect(page.getByLabel('Resultado: 5', { exact: true })).toHaveCount(0);
});

test('la bienvenida conserva el aviso cuando no puede guardar preferencias', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('mathvoice.v1.preferences'));
  await page.reload();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'mathvoice.v1.preferences') throw new DOMException('Blocked', 'SecurityError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Activar guía por voz', exact: true }).click();
  await expect(page.getByLabel('Expresión matemática', { exact: true })).toBeFocused();
  await page.waitForTimeout(300);
  const messages = await page.evaluate(
    () => (window as unknown as { __spoken: string[] }).__spoken,
  );
  expect(messages.at(-1), JSON.stringify(messages)).toContain('Bienvenido a MathVoice');
  expect(messages.at(-1)).toContain('se perderán al cerrar');
});

for (const guided of [false, true]) {
  test(`historial bloqueado informa pérdida de datos con ${guided ? 'voz propia' : 'lector externo'}`, async ({
    page,
  }) => {
    if (guided)
      await page.getByRole('button', { name: 'Guía por voz', exact: true, pressed: false }).click();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'mathvoice.v1.history')
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    const expression = page.getByLabel('Expresión matemática', { exact: true });
    await expression.fill('9*9');
    await expression.press('Enter');
    await expect(page.getByLabel('Resultado: 81', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('se perderán al cerrar');
    await expect(page.getByRole('region', { name: 'Resultado', exact: true })).not.toContainText(
      'Guardado en tu historial local',
    );
    await expect(expression).toBeFocused();
    const messages = await page.evaluate(
      () => (window as unknown as { __spoken: string[] }).__spoken,
    );
    if (guided) {
      expect(messages.at(-1)).toContain('Resultado: 81');
      expect(messages.at(-1)).toContain('se perderán al cerrar');
    } else {
      expect(messages).toEqual([]);
      await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    }
    await page.keyboard.press('Alt+Shift+h');
    await expect(
      page.getByRole('button', { name: 'Editar cálculo 9*9', exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole('link', { name: 'Historial', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Editar cálculo 9*9', exact: true })).toHaveCount(
      0,
    );
  });
}

test('repetir orientación actualiza la región viva sin activar voz propia', async ({ page }) => {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill('8*9');
  const where = page.getByRole('button', { name: '¿Dónde estoy?', exact: true });
  await where.focus();
  await page.keyboard.press('Enter');
  const status = page.getByRole('status');
  await expect(status).toContainText('Calculadora. Modo escritura. Lector de pantalla externo');
  const first = await status.textContent();
  await status.evaluate((element) => {
    const updates: string[] = [];
    Object.defineProperty(window, '__statusUpdates', { value: updates });
    new MutationObserver(() => updates.push(element.textContent ?? '')).observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await page.keyboard.press('Enter');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __statusUpdates: string[] }).__statusUpdates),
    )
    .toContain(first);
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(where).toBeFocused();
  await expect(expression).toHaveValue('8*9');
  expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual(
    [],
  );
});

test('probar y pausar voz no se interrumpen por el foco de sus controles', async ({ page }) => {
  await page.getByRole('button', { name: 'Guía por voz', exact: true, pressed: false }).click();
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await page.getByRole('button', { name: 'Probar voz', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect((await spoken()).at(-1)).toBe('Esta es la voz de MathVoice. Dos más dos es cuatro.');
  const messages = await spoken();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Pausar voz', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await spoken()).toEqual(messages);
  expect(
    await page.evaluate(
      () => (window as unknown as { __speechControls: unknown }).__speechControls,
    ),
  ).toEqual({ pauses: 1, resumes: 0 });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  expect(
    await page.evaluate(
      () => (window as unknown as { __speechControls: unknown }).__speechControls,
    ),
  ).toEqual({ pauses: 1, resumes: 1 });
});

test('cancelar el vaciado explica la decisión y devuelve el foco sin perder historial', async ({
  page,
}) => {
  await page.getByLabel('Expresión matemática', { exact: true }).fill('2+3');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Resultado: 5', { exact: true })).toBeVisible();
  await page.keyboard.press('Alt+Shift+h');
  const clear = page.getByRole('button', { name: 'Vaciar historial', exact: true });
  await clear.focus();
  await page.keyboard.press('Enter');
  const cancel = page.getByRole('button', { name: 'Cancelar', exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(clear).toBeFocused();
  await expect(page.getByRole('button', { name: 'Editar cálculo 2+3', exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(cancel).toHaveAccessibleDescription(
    '¿Eliminar todos los cálculos guardados en este dispositivo?',
  );
});

test('cada herramienta recupera su resultado y su error sin contaminar las demás', async ({
  page,
}) => {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.fill('6*7');
  await expression.press('Enter');
  await expect(page.getByLabel('Resultado: 42', { exact: true })).toBeVisible();
  await openTool(page, 'Matrices');
  await page.getByRole('button', { name: 'Calcular matriz', exact: true }).click();
  await expect(page.getByLabel('Resultado: -2', { exact: true })).toBeVisible();
  await openTool(page, 'Calculadora');
  await expect(expression).toHaveValue('6*7');
  await expect(page.getByLabel('Resultado: 42', { exact: true })).toBeVisible();
  await expression.fill('sin(');
  await expression.press('Enter');
  await expect(page.getByRole('alert')).not.toBeEmpty();
  await openTool(page, 'Matrices');
  await expect(page.getByRole('alert')).toBeEmpty();
  await expect(page.getByLabel('Resultado: -2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '¿Dónde estoy?' }).click();
  await expect(page.getByRole('status')).toContainText('Sin errores');
  await openTool(page, 'Calculadora');
  await expect(expression).toHaveValue('sin(');
  await expect(page.getByRole('alert')).not.toBeEmpty();
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
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Entendí:');
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
