# Verificación de la primera entrega

## Actualización 0.2

Verificación final local: **66 pruebas unitarias y 8 pruebas de navegador aprobadas**, ESLint y build correctos. La auditoría axe no encontró violaciones en los cinco temas probados; se verificó reflow a 320 px. No equivale a certificación WCAG ni reemplaza una prueba con usuarios ciegos y lectores reales.

Se agregaron pruebas unitarias de derivadas parciales y de orden superior, primitivas con C, integral definida polinómica, límites, raíces verificadas por sustitución, factorización/expansión por equivalencia, logaritmos, sistemas lineales y entradas inválidas. Las pruebas de navegador cubren teclado numérico, continuidad del resultado, memoria persistente, hover sin repeticiones, foco, Escape, desactivación y formularios CAS. La lectura real con voces instaladas continúa requiriendo prueba manual.

Repositorio remoto privado: https://github.com/frangaming67/mathvoice. El workflow de GitHub ejecuta lint, pruebas unitarias, build y Playwright. Los resultados de la primera entrega de abajo se conservan como registro histórico; el CAS y la memoria ya están incorporados.

Limitaciones actuales del CAS: integrales definidas de polinomios, sistemas lineales cuadrados con solución única, orden máximo de derivación 10. Los límites no resueltos agotan como máximo el tiempo del Worker (6 segundos). Las comprobaciones de dominio no equivalen a una demostración general. Se distingue log base 10 de ln natural y se evita presentar polos con signos opuestos como un límite bilateral confirmado.

## Registro de la versión 0.1

Entorno: Windows, Node.js 24, Chromium de Playwright. Fecha: 16 de septiembre de 2026.

- Build de producción y TypeScript estricto: correcto.
- ESLint: correcto.
- Vitest: 39 pruebas unitarias, operaciones, fracciones, dominios inválidos, modos angulares, lectura estructurada y almacenamiento dañado/bloqueado.
- Playwright: flujo de cálculo y errores; persistencia y recálculo con modo angular original; Tab/Shift+Tab y atajos; síntesis simulada con activación, lectura y cancelación; auditoría axe de cinco temas y reflow a 320 px.
- Capturas de escritorio y móvil inspeccionadas. Las capturas quedan en `test-results/`, excluido de Git.
- npm install: auditoría sin vulnerabilidades reportadas al instalar.

Límites de esta evidencia: la prueba de síntesis utiliza una implementación simulada para verificar llamadas, no la calidad acústica de voces reales. Axe no verifica toda WCAG. Las combinaciones de lector y navegador, zoom real 200/400%, navegación móvil asistida y pruebas con usuarios ciegos siguen pendientes; ver ACCESSIBILITY.md.

El build advierte que el paquete principal (~894 kB sin compresión, ~258 kB gzip) supera 500 kB; el Worker matemático ocupa ~653 kB. Se prioriza aislamiento del cálculo en esta fase. La optimización de imports y carga diferida está prevista para la fase 5.

No incluye todavía CAS, matrices, variables/memoria, gráficos, dictado, conversores, exportaciones o PWA. No hay un backend ni un repositorio remoto configurado. La entrega queda versionada en Git local.
