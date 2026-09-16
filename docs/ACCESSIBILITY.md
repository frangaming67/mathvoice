# Validación de accesibilidad

Objetivo: WCAG 2.2 AA. Los tests automáticos no equivalen a certificación.

## Protocolo manual pendiente

En NVDA + Chrome, JAWS + Chrome/Edge y VoiceOver + Safari:

1. Abrir, localizar título y bienvenida, activar o saltar guía.
2. Usar solo Tab y Shift+Tab; comprobar nombres, orden y foco visible.
3. Calcular `sqrt(25)+sin(pi/2)`, escuchar 6, repetir y detener con Escape.
4. Introducir `sqrt(`; verificar error anunciado y foco en expresión.
5. Cambiar modo angular y calcular `sen(30)` en grados: 0.5.
6. Leer `2*(3+4)` y confirmar que se anuncia agrupación.
7. Buscar, editar, recalcular y eliminar un cálculo del historial; confirmar vaciado.
8. Desactivar guía y usar lector externo; evitar duplicación de locuciones.
9. Probar todos los temas, zoom 200% y 400%, ancho 320 px, voz ausente y almacenamiento bloqueado.
10. Comprobar que Ctrl+R/H/L siguen disponibles para el navegador.

Registrar navegador, versión, lector, voz instalada, resultado y problemas. La síntesis real, percepción del habla, contraste en todos los ajustes y uso independiente requieren revisión humana.
