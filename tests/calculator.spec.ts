import { resultValue } from './navigation';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('flujo por teclado, fracciones, historial persistente y errores', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
  const input = page.getByLabel('Expresión matemática', { exact: true });
  await expect(input).toBeFocused();
  await input.fill('1/3 + 1/6');
  await input.press('Enter');
  await expect(resultValue(page, '1/2')).toBeVisible();
  await expect(input).toBeFocused();
  await page.reload();
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Editar cálculo 1/3 + 1/6', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Calculadora', exact: true }).click();
  await input.fill('1/0');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('No se puede dividir por cero');
  await expect(input).toBeFocused();
  await input.press('F1');
  await expect(page.getByRole('heading', { name: 'Ayuda', exact: true, level: 1 })).toBeFocused();
  await page.getByRole('button', { name: 'Cerrar ayuda' }).click();
  await expect(input).toBeFocused();
});

test('modos, herramientas y recálculo conservan semántica', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
  await page.getByLabel('Modo angular').selectOption('deg');
  await page.getByLabel('Expresión matemática', { exact: true }).fill('sen(30)');
  await page.getByRole('button', { name: 'Calcular', exact: false }).first().click();
  await expect(resultValue(page, '0.5')).toBeVisible();
  await page.getByLabel('Modo angular').selectOption('rad');
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await page.getByRole('button', { name: 'Recalcular sen(30)', exact: true }).click();
  await expect(page.getByLabel('Modo angular')).toHaveValue('deg');
  await expect(resultValue(page, '0.5')).toBeVisible();
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await page.getByRole('button', { name: 'Vaciar historial' }).click();
  await page.getByRole('button', { name: 'Sí, eliminar todos' }).click();
  await expect(page.getByText('Tus cálculos aparecerán acá.')).toBeVisible();
});

test('accesibilidad automática, temas y reflow a 320 px', async ({ page }) => {
  await page.goto('/');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  for (const theme of ['dark', 'contrast', 'mono', 'yellow', 'light']) {
    await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption(theme);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.reload();
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await page.screenshot({ path: 'test-results/mathvoice-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/mathvoice-desktop.png', fullPage: true });
});

test('Tab, Shift+Tab y atajos de lectura conservan el foco y no calculan', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Expresión matemática', { exact: true });
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
  await expect(input).toBeFocused();
  // En las visitas siguientes el foco arranca en el campo.
  await page.reload();
  await expect(input).toBeFocused();
  await expect(page).toHaveTitle('Calculadora — MathVoice');
  // Desde el principio de la página: saltar al contenido y llegar al campo en 10 paradas.
  await page.evaluate(() => {
    // Punto de partida de Tab al principio del documento.
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await page.evaluate(() => {
    // Punto de partida de Tab al principio del documento.
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
  for (let stop = 0; stop < 10; stop++) await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  await input.fill('2+2');
  await input.press('Control+Enter');
  await expect(resultValue(page, '4')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Calcular', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(input).toBeFocused();
  await page.keyboard.press('Alt+Shift+r');
  await expect(page.getByRole('heading', { name: 'Resultado', exact: true })).toBeFocused();
});

test('voz centralizada: activación, resultado y Escape', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    let cancellations = 0;
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [],
        speak: (u: SpeechSynthesisUtterance) => spoken.push(u.text),
        cancel: () => cancellations++,
        pause: () => {},
        resume: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
    Object.defineProperty(window, '__speechTest', {
      value: {
        spoken,
        get cancellations() {
          return cancellations;
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Activar guía por voz' }).click();
  await page.getByLabel('Expresión matemática', { exact: true }).fill('2+2');
  await page.getByLabel('Expresión matemática', { exact: true }).press('Enter');
  await expect(resultValue(page, '4')).toBeVisible();
  const spoken = await page.evaluate(
    () => (window as unknown as { __speechTest: { spoken: string[] } }).__speechTest.spoken,
  );
  expect(spoken[0]).toContain('Bienvenido');
  expect(spoken.at(-1)).toContain('Resultado: 4');
  const count = await page.evaluate(
    () =>
      (window as unknown as { __speechTest: { cancellations: number } }).__speechTest.cancellations,
  );
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __speechTest: { cancellations: number } }).__speechTest
          .cancellations,
    ),
  ).toBeGreaterThan(count);
});

test('el resultado llega como MathML al lector y se copia como LaTeX', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla' }).click();
  const input = page.getByLabel('Expresión matemática', { exact: true });
  await input.fill('integrate(x^2,x)');
  await input.press('Enter');
  await expect(resultValue(page, '(1/3)*x^3 + C')).toBeVisible();
  const value = page.locator('.result-value');
  const math = value.locator('math');
  await expect(math).toHaveAttribute(
    'alttext',
    'un tercio por equis al cubo más constante de integración',
  );
  await expect(math.locator('mfrac')).toHaveCount(1);
  await expect(math.locator('msup')).toHaveCount(1);
  await expect(value.locator('.result-syntax')).toHaveAttribute('aria-hidden', 'true');
  await expect(
    page.locator('.result-expression math msubsup, .result-expression math mo'),
  ).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Copiar como LaTeX' }).click();
  await expect(page.getByRole('status')).toContainText('LaTeX copiado');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    String.raw`\frac{1}{3} \cdot {x}^{3} + C`,
  );
  await page.getByRole('button', { name: 'Copiar como MathML' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('<mfrac>');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('con «texto hablado» el lector recibe la lectura en español en lugar de MathML', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'mathvoice.v1.preferences',
      JSON.stringify({ welcomed: true, guided: false, srMath: 'texto' }),
    ),
  );
  await page.goto('/');
  const input = page.getByLabel('Expresión matemática', { exact: true });
  await input.fill('1/3');
  await input.press('Enter');
  const value = page.locator('.result-value');
  await expect(value.locator('.math-element')).toHaveAttribute('aria-hidden', 'true');
  await expect(value.locator('.sr-only').last()).toHaveText(
    'un tercio, es decir 0 coma 3 periódico',
  );
});
