# MathVoice

Entorno matemático en español, pensado para trabajar sin mirar la pantalla.

## Desarrollo por fases

Esta entrega implementa la **fase 1**. No presenta las fases futuras como funciones disponibles.

1. Arquitectura, cálculo básico y científico, voz, accesibilidad e historial.
2. Álgebra, ecuaciones, derivadas, integrales y límites.
3. Matrices, vectores, complejos y estadística.
4. Gráficos SVG, exploración por teclado y sonificación.
5. Dictado con confirmación, conversiones, PWA y exportaciones.

## Ejecutar

Requiere Node.js 22.12 o posterior.

```sh
npm install
npm run dev
npm run build
npm test
npm run lint
npm run test:e2e
```

Para las pruebas de navegador: `npx playwright install chromium` una vez.

Ver [arquitectura](docs/ARCHITECTURE.md), [plan](docs/ROADMAP.md) y [validación accesible](docs/ACCESSIBILITY.md).

No necesita cuenta ni envía cálculos a servidores. La disponibilidad y calidad de voces depende del navegador y del sistema operativo. Se puede usar sin voz y con un lector externo. La voz comienza después de activarla explícitamente.
