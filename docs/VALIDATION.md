# Registro de validación

## Cierre local del 19 de septiembre de 2026

- 155 pruebas unitarias aprobadas: incluyen logaritmos con base, raíces espurias, límites laterales incompatibles, singularidades y desbordamientos.
- Flujos de navegador ampliados a 15 casos: atajos, escala persistente, matrices, voz, dictado, gráficos, exportación y axe. La revisión automática no certifica WCAG.
- Dos pruebas de producción aprobadas: recarga sin conexión con herramientas diferidas y actualización real del service worker conservando historial y preferencias.
- TypeScript y build aprobados. Tamaño medido: 2818 KiB de JavaScript total, paquete principal de aproximadamente 269 kB gzip, dentro del presupuesto automatizado.
- Dependencias instaladas sin vulnerabilidades reportadas por npm en esa ejecución.

El commit de publicación y su ejecución completa de CI quedan disponibles en GitHub Actions. La validación manual con NVDA, JAWS, VoiceOver, micrófono y usuarios reales sigue pendiente.

## Entrega 0.3 — alcance de las comprobaciones

La entrega incorpora módulos de las fases 3–5 y amplía la fase 2. Los resultados finales de lint, build, pruebas unitarias y navegador deben registrarse contra el commit de cierre; este documento no presenta ejecuciones intermedias como una aprobación final.

| Capa                     | Qué comprueba                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript y ESLint      | Contratos de tipos y reglas estáticas del proyecto                                                                                                                  |
| Vitest                   | Operaciones numéricas/simbólicas, matrices, vectores, complejos, estadística/probabilidad, conversiones, variables, gráficos, dictado, exportaciones y persistencia |
| Playwright               | Flujos con teclado, calculadora, voz simulada, memoria, CAS, matrices, tablas, variables, conversores, exportación, gráficos y dictado con confirmación             |
| axe                      | Problemas automáticos de accesibilidad en temas y herramientas abiertas                                                                                             |
| Playwright de producción | Service worker, recarga sin red, carga diferida, cálculo básico, matrices, derivadas y gráficos                                                                     |

Comandos reproducibles:

```sh
npm ci
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:pwa
```

`test:pwa` vuelve a compilar y ejecuta `playwright.pwa.config.ts`. CI puede reutilizar su build anterior con `npx playwright test --config playwright.pwa.config.ts`. Las pruebas de navegador y producción usan servidores separados para evitar confundir recursos de desarrollo con los de la PWA.

## Evidencia y casos relevantes

La prueba offline de producción se verificó localmente: tras activar el service worker y desconectar la red, se recargó la página y se calcularon `2+2`, un determinante y `diff(x^3,x)`; también se abrió el panel diferido de gráficos y se generaron curvas. Esta evidencia cubre ese flujo en Chromium. No prueba instalación o actualización en todos los navegadores, ni dictado o voces offline.

El corpus matemático incluye fracciones y números mixtos, matrices singulares y rango, normalización del vector cero, raíces complejas, muestra/población, regresión, probabilidades y bases con enteros grandes. Los casos simbólicos incluyen ecuaciones, sistemas lineales, órdenes de derivación, límites, desigualdades, Taylor y rechazo de integrales cuyo intervalo cruza singularidades. Los casos conocidos ayudan a detectar regresiones; no prueban corrección general de los motores.

En gráficos se comprueban discontinuidades de referencia, validación de expresiones y exploración con paso 0.01 sin ajustarlo al índice de la tabla. En dictado se comprueba que una transcripción no calcule antes de confirmación, que cancelar devuelva el foco y que un permiso denegado produzca un mensaje. La transcripción y la síntesis de estas pruebas son simuladas.

Historial y variables validan datos recuperados. Las pruebas cubren almacenamiento dañado/bloqueado y estructuras de resultados. La exportación CSV prueba comillas y neutralización de prefijos interpretables como fórmulas; JSON preserva un sobre versionado.

## Límites de esta evidencia

- No se declara conformidad WCAG ni uso independiente validado con personas ciegas. NVDA, JAWS, VoiceOver, voces reales, zoom real 200/400% y navegación móvil asistida siguen pendientes según [ACCESSIBILITY.md](ACCESSIBILITY.md).
- El análisis de dominio de integrales es conservador; un rechazo puede significar que no se pudo verificar continuidad. No hay soporte general de integrales impropias. El CAS y sus aproximaciones tienen límites documentados en [ROADMAP.md](ROADMAP.md).
- Los 401 puntos del gráfico y sus cortes heurísticos pueden omitir discontinuidades, ceros o extremos. La sonificación necesita evaluación perceptual humana.
- La interfaz permite voz inglesa, pero sigue en español y la interpretación de dictado está orientada a frases españolas.
- No hay una auditoría de rendimiento en equipos modestos, una cota general del error numérico ni pruebas exhaustivas de las bibliotecas matemáticas.
- Una ejecución local aprobada no implica que el mismo commit esté publicado ni que CI haya terminado. El resultado remoto se comprueba en [GitHub Actions](https://github.com/frangaming67/mathvoice/actions).

## Registro histórico 0.2

La entrega 0.2 registró **66 pruebas unitarias y 8 de navegador aprobadas**, ESLint y build correctos. Incluía calculadora, memoria, lectura por puntero/foco, CAS, prueba de cinco temas con axe y reflow a 320 px. La síntesis estaba simulada; no se validaron lectores reales. Esas cifras describen esa entrega, no la suite ampliada actual.

## Registro histórico 0.1

El 16 de septiembre de 2026, en Windows, Node.js 24 y Chromium de Playwright, se verificaron build, TypeScript, ESLint y 39 pruebas unitarias. Se probaron cálculo, errores, historial, persistencia, teclado, voz simulada, cinco temas y ancho 320 px. Se inspeccionaron capturas de escritorio y móvil. La auditoría de dependencias al instalar no reportó vulnerabilidades en aquella ejecución.

Las limitaciones de funciones documentadas en 0.1 quedaron reemplazadas por las entregas posteriores; consultar el plan actual para el alcance funcional.
