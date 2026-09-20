# Cambios

## 0.4.0 — 2026-09-20

- Procedimientos con fórmulas y valores del cálculo: ecuaciones lineales/cuadráticas, sustitución de raíces, derivadas sucesivas, integrales, Taylor y análisis de signos de desigualdades.
- Lectura de cada paso o del procedimiento completo; lectura automática al pasar el puntero; conservación en historial y exportaciones TXT, CSV y JSON.
- Refinamiento por bisección de ceros/intersecciones y por búsqueda local de extremos; control del residuo y eliminación de duplicados.
- Intersecciones identificadas por las dos curvas, descripción de valores muestreados y salto accesible a eventos.
- Validación de argumentos y rangos de gráficos; no se enumeran tramos constantes como ceros aislados.

Avance de las fases 2 y 4, con persistencia/exportación de fase 5. Los procedimientos no cubren todas las reglas de derivación ni métodos generales de resolución; el muestreo sigue pudiendo omitir eventos.

## 0.3.0 — 2026-09-19

- Matrices con editor por teclado, vectores, complejos, estadística, probabilidad y variables persistentes.
- Gráficos SVG de hasta cuatro funciones, tabla, exploración con paso exacto y sonificación.
- Dictado con revisión obligatoria, conversores, operaciones binarias y exportación TXT/CSV/JSON.
- PWA offline con aviso de actualización y recarga explícita; carga diferida y control de tamaño en CI.
- Desigualdades hasta grado 2, Taylor, integrales definidas con análisis conservador de dominio, mixtos y constantes físicas.
- Verificación de raíces contra la ecuación original, corrección de logaritmos con base y controles de límites y desbordamientos.
- Lectura de tablas y selectores, atajos, escala general y descarga/gráfico del resultado.

El alcance y los límites se detallan en [ROADMAP](docs/ROADMAP.md). Las pruebas automáticas no sustituyen la evaluación con lectores de pantalla y usuarios reales.

## 0.2.0

Teclado parlante, memoria, lectura por puntero/foco, álgebra y cálculo simbólico; repositorio privado y CI.
