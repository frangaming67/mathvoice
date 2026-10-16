# Estado por fases — entrega 0.4

Este estado sigue el punto 58 de [REQUISITOS-ORIGINALES.txt](REQUISITOS-ORIGINALES.txt). Hay una entrega funcional de las cinco fases. Eso no implica haber validado todos los casos matemáticos ni el uso independiente con lectores de pantalla reales.

| Fase                                                       | Estado de la entrega                                  | Cierre pendiente                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Base, científica, voz, accesibilidad e historial        | Implementada, con pruebas automáticas                 | Validación manual con lectores reales y personas ciegas                   |
| 2. Álgebra y cálculo                                       | Implementada dentro del alcance indicado abajo        | Ampliación matemática, procedimientos detallados y auditoría de dominios  |
| 3. Matrices, vectores, complejos y estadística             | Implementada, con resultados tabulares y formularios  | Auditoría numérica ampliada y uso con lectores reales                     |
| 4. Gráficos, teclado y sonificación                        | Implementada con exploración y alternativas textuales | Mejorar detección de eventos y evaluar comprensión del audio con usuarios |
| 5. Dictado, conversores, PWA, exportaciones y optimización | Implementada; prueba offline de producción disponible | Pruebas de instalación, micrófono real, dispositivos y rendimiento        |

## Fase 1

- Motor básico y científico, fracciones exactas, números mixtos, alias, modos angulares y teclado numérico.
- Voz centralizada, lectura matemática, activación explícita, lectura automática de foco/puntero y Escape para detener.
- Preferencias persistentes, cinco temas, tamaño de texto e interlineado, ayuda y navegación por teclado.
- Historial local de hasta 100 entradas, búsqueda, escucha, copia, edición, recálculo y eliminación.
- Memoria MC/MR/M+/M− y constantes matemáticas.

Pendiente: completar el [protocolo manual](ACCESSIBILITY.md). La voz disponible depende del navegador y el sistema. Seleccionar una voz inglesa no traduce la interfaz ni convierte el parser de dictado a inglés.

## Fase 2

Avance 0.4: procedimientos accesibles y persistidos. Se muestran coeficientes, discriminante y fórmula de ecuaciones cuadráticas; despeje lineal; verificación numérica de raíces; derivadas sucesivas; primitiva, extremos y diferencia de integrales; términos de Taylor; análisis de signos de desigualdades. No se muestra una derivación completa de cada regla ni eliminación paso a paso de sistemas.

- Adaptador Nerdamer en Worker con validación de entrada y máximo de seis segundos.
- Simplificación, expansión, factorización, sustitución y fracciones parciales.
- Ecuaciones y sistemas lineales de 2–5 ecuaciones con solución única verificada.
- Desigualdades polinómicas reales de una variable, hasta grado 4, también escritas sueltas (x^2-4>0).
- Derivadas respecto de una variable, incluidas parciales, de órdenes 1–10.
- Integrales indefinidas con `+ C`; definidas con comprobación conservadora del dominio y primitiva cerrada; límites mediante CAS.
- Taylor de órdenes 0–10, identificado como aproximación local sin cota del error.

Pendiente: sistemas no lineales, desigualdades de mayor alcance, integrales impropias o sin primitiva cerrada, reglas detalladas de derivación/integración y procedimientos de sistemas y límites. Los pasos disponibles no constituyen una demostración completa para toda expresión. Un rechazo del análisis de dominio puede ser inconcluso. Nerdamer no garantiza resolución general ni todas las raíces de ecuaciones trascendentes.

## Fase 3

- Editor de matrices de hasta 6 × 6, con etiquetas por fila/columna y navegación con flechas.
- Suma, resta, producto, determinante, inversa, transpuesta, rango, traza, autovalores, autovectores y resolución `A × X = B`.
- Vectores: módulo, normalización, productos punto/cruz, ángulo, distancia, suma y resta.
- Complejos: aritmética, partes real/imaginaria, conjugado, polar/rectangular, potencias, raíz principal y todas las raíces de índice 1–32.
- Estadística descriptiva, muestra/población, cuartiles, percentiles, covarianza, correlación y regresión lineal.
- Distribuciones normal, binomial y Poisson; combinaciones y permutaciones.
- Hasta 100 variables reales persistentes y constantes físicas con unidades y fuente.

Límites: los cálculos numéricos pueden perder precisión con matrices mal condicionadas; no se calcula una garantía general del error. Las variables no almacenan matrices, complejos ni funciones. Las unidades de constantes físicas no se propagan automáticamente.

## Fase 4

Avance 0.4: refinamiento de ceros e intersecciones por bisección con control del residuo, estimación local más fina de extremos y eventos sin duplicados. Las intersecciones identifican ambas curvas y generan su señal sonora al explorar cualquiera de ellas. Hay salto al evento con recuperación del foco y descripción de los valores muestreados. Los tramos constantes/coincidentes no se enumeran como puntos aislados.

- Hasta cuatro funciones reales, SVG con trazos distinguibles, rangos configurables y ajuste del rango X.
- Exploración por flechas, Inicio/Fin y pasos 0.01, 0.1, 0.5, 1 y 5, calculados independientemente de la tabla.
- Coordenadas habladas, tabla de 401 muestras y lista de ceros, extremos e intersecciones aproximados.
- Sonificación de altura y señales diferenciadas por evento; Escape detiene el recorrido.

Límites: el muestreo de 400 intervalos puede omitir eventos y discontinuidades. No equivale a un análisis exacto del dominio, crecimiento o extremos. La detección de saltos es heurística. La evaluación de la sonificación con personas ciegas está pendiente.

## Fase 5

Avance 0.4: procedimientos incluidos en TXT, CSV y JSON, recuperables desde el historial y validados al leer el almacenamiento. El historial anterior sigue siendo compatible.

La versión 0.3 añade aviso de actualización de la PWA con recarga voluntaria y conservación del historial. CI verifica un presupuesto de 320 KiB gzip para el paquete principal y 3.5 MiB de JavaScript total. Se comprobó la escala de interfaz al 200% con reflow equivalente a 320 píxeles; esto no sustituye las pruebas manuales de zoom y lectores reales.

- Dictado por Web Speech con revisión, edición, confirmación o cancelación antes de calcular.
- Conversión de unidades en 12 categorías; bases 2, 8, 10 y 16; operaciones binarias de 8/16/32/64 bits.
- PWA con caché de recursos de producción; prueba de recarga y herramientas diferidas sin red.
- Exportación TXT, CSV y JSON, con protección de celdas CSV que podrían interpretarse como fórmulas.
- Carga diferida de paneles y separación del cálculo/gráficos en Workers.

Pendiente: dictado y voces reales en distintos navegadores, instalación y actualización de PWA en dispositivos, medición de rendimiento en equipos modestos y auditoría manual integral. El dictado puede usar servidores del proveedor del navegador y no se garantiza offline. La primera carga completa requiere conexión.

El [registro de validación](VALIDATION.md) separa pruebas automáticas, evidencia histórica y pruebas pendientes. El estado de GitHub debe comprobarse contra el commit publicado; los cambios locales por sí solos no prueban una publicación.
