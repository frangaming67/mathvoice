import { expect, test } from '@playwright/test';

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
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla', exact: true }).click();
});
const lastSpoken = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.at(-1));

test('con lector de pantalla: cierres, desbalance y comandos sobre el cursor', async ({ page }) => {
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  const status = page.getByRole('status');
  await expression.pressSequentially('sqrt(9');
  await page.keyboard.press('Control+Enter');
  await expect(status).toContainText(
    'Falta cerrar 1 paréntesis, abierto después de raíz cuadrada.',
  );
  await expression.press('End');
  await expression.pressSequentially(')');
  await expect(status).toHaveText('Cierra raíz cuadrada.');
  // Desde la paleta, el comando lee y devuelve el cursor al lugar donde estaba.
  await page.keyboard.press('Alt+Shift+p');
  await page.getByRole('combobox', { name: 'Buscar comando' }).fill('revisar parentesis');
  await page.getByRole('combobox', { name: 'Buscar comando' }).press('Enter');
  await expect(status).toHaveText('Los paréntesis están completos.');
  await expect(expression).toBeFocused();
  await page.keyboard.type('+1');
  await expect(expression).toHaveValue('sqrt(9)+1');
  // En modo matemático: «; O» dice dónde está el cursor y «; P» va a la pareja.
  await expression.press('ArrowLeft');
  await expression.press('ArrowLeft');
  await page.keyboard.press('F2');
  await expect(
    page.getByRole('application', { name: 'Área del teclado matemático', exact: true }),
  ).toBeFocused();
  await page.keyboard.press(';');
  await page.keyboard.press('o');
  await expect(status).toHaveText('Después de cierra paréntesis, antes de más.');
  await page.keyboard.press(';');
  await page.keyboard.press('p');
  await expect(status).toHaveText('Pareja: abre raíz cuadrada, en la posición 5.');
  await page.keyboard.press(';');
  await page.keyboard.press('k');
  await expect(status).toHaveText('abre paréntesis');
  await page.keyboard.press(';');
  await page.keyboard.press('f');
  await expect(status).toHaveText('abre paréntesis 9 cierra paréntesis más 1');
});

test('con la guía por voz: el cursor y los borrados se dicen', async ({ page }) => {
  await page.getByRole('button', { name: 'Guía por voz', exact: true, pressed: false }).click();
  const expression = page.getByLabel('Expresión matemática', { exact: true });
  await expression.focus();
  await expression.pressSequentially('x+12');
  await expression.press('Home');
  await expect.poll(() => lastSpoken(page)).toBe('equis');
  await expression.press('ArrowRight');
  await expect.poll(() => lastSpoken(page)).toBe('más');
  await expression.press('Control+ArrowRight');
  await expect.poll(() => lastSpoken(page)).toMatch(/^(12|doce)$/);
  await expression.press('End');
  await expect.poll(() => lastSpoken(page)).toBe('Final de la expresión.');
  await expression.press('Backspace');
  await expect.poll(() => lastSpoken(page)).toBe('Borraste 2.');
});
