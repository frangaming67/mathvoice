# Verificación de la primera entrega

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
