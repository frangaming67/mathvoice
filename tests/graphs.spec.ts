import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openTool } from './navigation';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi lector de pantalla', exact: true }).click();
});

async function graph(page: Page, functions: string) {
  await openTool(page, 'Gráficos');
  await page
    .getByRole('textbox', { name: 'Funciones de x, una por línea (hasta 4)', exact: true })
    .fill(functions);
  await page.getByRole('button', { name: 'Graficar funciones', exact: true }).click();
  const explorer = page.getByRole('slider', { name: 'Explorar gráfico', exact: true });
  await expect(explorer).toBeVisible();
  return explorer;
}

test('el explorador es un deslizador que dice dónde está y qué cruzó', async ({ page }) => {
  const explorer = await graph(page, 'x^2-2');
  await page.getByRole('combobox', { name: 'Paso en X', exact: true }).selectOption('1');
  await explorer.focus();
  await page.keyboard.press('Home');
  await expect(explorer).toHaveAttribute('aria-valuetext', 'Equis igual a -5; ye igual a 23');
  await expect(explorer).toHaveAttribute('aria-valuenow', '-5');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(explorer).toHaveAttribute('aria-valuetext', 'Equis igual a -2; ye igual a 2');
  // Entre -2 y -1 hay un cero: se avisa aunque el paso lo salte.
  await page.keyboard.press('ArrowRight');
  await expect(explorer).toHaveAttribute(
    'aria-valuetext',
    'Equis igual a -1; ye igual a -1. Pasaste por un cero en equis -1.41421.',
  );
  // Z va al cero siguiente; Re Pág avanza diez pasos.
  await page.keyboard.press('z');
  await expect(explorer).toHaveAttribute(
    'aria-valuetext',
    /^cero aproximado\. Equis igual a 1\.41421/,
  );
  await page.keyboard.press('Home');
  await page.keyboard.press('PageUp');
  await expect(explorer).toHaveAttribute('aria-valuenow', '5');
  // Con lector de pantalla, el deslizador se lee solo: no se repite en la región viva.
  await expect(page.getByRole('status')).not.toContainText('Equis igual a 5');
  // Los botones sirven en el celular y sí se anuncian.
  await page.getByRole('button', { name: 'Punto anterior', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Equis igual a 4; ye igual a 14');
  await expect(page.locator('.coordinates')).toHaveText('Equis igual a 4; ye igual a 14');
  const results = await new AxeBuilder({ page }).include('.graph-explorer').analyze();
  expect(results.violations).toEqual([]);
});

test('con coma decimal, el gráfico lee funciones y dice coordenadas con coma', async ({ page }) => {
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await page.getByRole('combobox', { name: 'Separador decimal' }).selectOption('coma');
  const explorer = await graph(page, '0,5*x');
  await explorer.focus();
  await page.keyboard.press('Home');
  await expect(explorer).toHaveAttribute('aria-valuetext', 'Equis igual a -5; ye igual a -2,5');
  await page.keyboard.press('ArrowRight');
  await expect(explorer).toHaveAttribute('aria-valuetext', 'Equis igual a -4,9; ye igual a -2,45');
});

test('durante el recorrido sonoro el deslizador no se mueve para no saturar al lector', async ({
  page,
}) => {
  const explorer = await graph(page, 'x^2');
  await explorer.focus();
  await page.keyboard.press('Home');
  const before = await explorer.getAttribute('aria-valuetext');
  await page.keyboard.press('s');
  await expect(page.getByRole('button', { name: 'Detener sonificación' })).toBeVisible();
  await expect(page.locator('.coordinates')).not.toHaveText(before!);
  await expect(explorer).toHaveAttribute('aria-valuetext', before!);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Sonificar recorrido' })).toBeVisible();
});

test('describe el gráfico, ajusta Y, acerca en el punto y descarga para relieve', async ({
  page,
}) => {
  const explorer = await graph(page, 'x^2');
  await expect(page.locator('.graph-svg')).toHaveAttribute('aria-describedby', 'graph-summary');
  const summary = page.locator('#graph-summary');
  await expect(summary).toContainText('Función 1, x^2.');
  await expect(summary).toContainText('Decrece desde x -5 hasta x 0 y crece desde x 0 hasta x 5.');
  await expect(summary).toContainText('Toca el eje x sin cruzarlo en x 0.');
  await explorer.focus();
  await page.keyboard.press('d');
  await expect(page.getByRole('status')).toContainText(
    'Función 1, x^2. Definida en todo el intervalo',
  );
  await page.getByRole('button', { name: 'Ajustar Y a la curva', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Rango Y ajustado a la curva');
  await expect(page.getByLabel('Y máximo', { exact: true })).not.toHaveValue('10');
  // Acercar con centro en x = 3 y quedarse ahí.
  await page.getByRole('combobox', { name: 'Paso en X', exact: true }).selectOption('1');
  await explorer.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: 'Acercar alrededor del punto', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('X de 0.5 a 5.5. Seguís en equis 3.');
  await expect(explorer).toHaveAttribute('aria-valuenow', '3');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar para relieve (SVG)', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('mathvoice-grafico-relieve.svg');
  const svg = Buffer.concat(await (await file.createReadStream()).toArray()).toString('utf8');
  expect(svg).toContain('<title id="titulo">Gráfico de x^2</title>');
  expect(svg).toContain('stroke-width="6"');
});

test('tan(x) muestra sus asíntotas y el explorador las avisa al cruzarlas', async ({ page }) => {
  const explorer = await graph(page, 'tan(x)');
  await expect(page.locator('#graph-summary')).toContainText('Asíntotas verticales en x -4.71239');
  await page.getByRole('combobox', { name: 'Paso en X', exact: true }).selectOption('1');
  await explorer.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(explorer).toHaveAttribute(
    'aria-valuetext',
    /Pasaste por una asíntota vertical en equis -4\.71239/,
  );
});
