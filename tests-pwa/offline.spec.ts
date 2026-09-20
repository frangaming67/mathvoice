import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

test('producción: recarga sin conexión, herramientas diferidas y cálculo simbólico', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar sin guía' }).click();
  await expect(page.getByText(/Aplicación preparada para usar sin conexión/)).toBeVisible({
    timeout: 30000,
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Sin conexión. Los cálculos locales/)).toBeVisible();
  const input = page.getByLabel('Expresión matemática', { exact: true });
  await input.fill('2+2');
  await input.press('Enter');
  await expect(page.getByLabel('Resultado: 4', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Matrices', exact: true }).click();
  await page.getByRole('button', { name: 'Calcular matriz' }).click();
  await expect(page.getByLabel('Resultado: -2', { exact: true })).toBeVisible();
  await input.fill('diff(x^3,x)');
  await input.press('Enter');
  await expect(page.getByLabel('Resultado: 3*x^2', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Gráficos', exact: true }).click();
  await page.getByRole('button', { name: 'Graficar funciones' }).click();
  await expect(page.getByRole('button', { name: 'Explorar gráfico', exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('actualización requiere acción y conserva historial al recargar', async ({ page }) => {
  const original = await readFile('dist/sw.js', 'utf8');
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continuar sin guía' }).click();
    await expect(page.getByText(/Aplicación preparada para usar sin conexión/)).toBeVisible({
      timeout: 30000,
    });
    await page.reload();
    const input = page.getByLabel('Expresión matemática', { exact: true });
    await input.fill('2+2');
    await input.press('Enter');
    await expect(page.getByLabel('Resultado: 4', { exact: true })).toBeVisible();
    await writeFile('dist/sw.js', `${original}\n// Prueba de actualización ${Date.now()}\n`);
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
    const update = page.getByRole('button', { name: 'Aplicar actualización y recargar' });
    await expect(update).toBeVisible();
    const reload = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
    await update.click();
    await reload;
    await expect(
      page.getByRole('button', { name: 'Editar cálculo 2+2', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar sin guía' })).toHaveCount(0);
  } finally {
    await writeFile('dist/sw.js', original);
  }
});
