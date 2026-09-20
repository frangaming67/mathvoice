# Arquitectura — MathVoice 0.4

Aplicación cliente de una página con React, TypeScript estricto, Vite y CSS propio. No requiere backend ni registro. Las expresiones se calculan localmente; historial, variables, memoria y preferencias se guardan en el navegador. Dictado y algunas voces pueden usar servicios del proveedor del navegador.

## Responsabilidades

| Componente o servicio                                                       | Responsabilidad                                                                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `features/calculator/Calculator`                                            | Coordina expresión, resultados, persistencia, anuncios y herramientas                                                         |
| `CalculatorClient` y `calculator.worker`                                    | Ejecutan una petición matemática en un Worker y lo terminan al completar o a los seis segundos                                |
| `MathEngine` y `mathRuntime`                                                | Normalización, validación de AST, aritmética y funciones de Math.js, contexto de variables y resultados serializables         |
| `SymbolicEngine`                                                            | Traduce comandos validados a Nerdamer y comprueba resultados y límites de alcance                                             |
| `DomainService`                                                             | Calcula cotas conservadoras sobre intervalos para comprobar continuidad antes de integrar y regularidad local antes de Taylor |
| `ExtensionFunctions`                                                        | Matrices, vectores, complejos, estadística y distribuciones; usa Math.js, ml-matrix y jStat                                   |
| `ResultFormatter` y `resultSpeech`                                          | Representaciones escalares, complejas, tablas y matrices; lectura estructurada de resultados                                  |
| `GraphService`, `GraphClient` y `graph.worker`                              | Validación, muestreo y eventos de curvas, con Worker limitado a seis segundos                                                 |
| `SonificationService`                                                       | Tonos Web Audio para altura y eventos, activados por gesto del usuario                                                        |
| `SpeechService`                                                             | Único propietario de `speechSynthesis`: voces, configuración, pausa, repetición y cancelación                                 |
| `MathSpeechFormatter` y `useAutomaticSpeech`                                | Lectura matemática y coordinación de foco/puntero sin convertir texto estático en controles                                   |
| `VoiceRecognitionService` y `voiceExpression`                               | Reconocimiento del navegador y conversión limitada de frases españolas; el diálogo exige confirmación                         |
| `StorageService`, `HistoryService`, `VariableService`, `PreferencesService` | Persistencia local, validación y recuperación ante datos dañados o almacenamiento bloqueado                                   |
| `ConversionService` y `ExportService`                                       | Unidades, bases, operaciones binarias y archivos TXT/CSV/JSON                                                                 |
| `FeatureHub`                                                                | Paneles cargados bajo demanda mediante `lazy` y `Suspense`                                                                    |

## Cálculo y contratos

`MathEngine.evaluate(expression, angleMode, variables): CalculationResult` es la entrada al motor. La UI utiliza el contrato asíncrono de `CalculatorClient.evaluate`. El resultado conserva expresión, valor textual, tipo, explicación y modo angular; puede incluir aproximación decimal, tabla, matriz, unidad y asignación de variable. El historial guarda también el contexto de variables para recalcular con el estado original.

El parser acepta solo nodos, operadores y funciones de una lista permitida. No evalúa JavaScript. La asignación de variables se procesa explícitamente; las variables deben ser números reales finitos y no pueden reemplazar funciones ni constantes reservadas. Hay límites de longitud y un máximo de 100 variables. El tiempo máximo del Worker limita operaciones costosas; no demuestra que toda entrada válida sea barata.

Math.js aporta aritmética, fracciones, complejos, matrices, estadística básica y unidades. ml-matrix aporta descomposición SVD para rango; jStat aporta distribuciones, covarianza y correlación. `log(x)` significa base 10, `ln(x)` logaritmo natural y `log(x,b)` usa la base indicada. Los modos angulares afectan trigonometría numérica directa/inversa y gráficos; no las funciones hiperbólicas. Los resultados simbólicos siempre usan radianes.

Nerdamer resuelve álgebra y cálculo dentro de `SymbolicEngine`. Los sistemas se limitan a 2–5 ecuaciones lineales con solución única comprobada. Las desigualdades admiten polinomios de una variable de grado máximo 2, con raíces numéricas y análisis de signo. Derivadas y Taylor tienen orden máximo 10. Los límites y ecuaciones no resueltos generan un mensaje; la ausencia de raíces encontradas no demuestra ausencia de soluciones.

Para integrales definidas se comprueba el AST original antes de que el CAS cancele factores. `DomainService` usa aritmética de intervalos conservadora; puede rechazar expresiones válidas por no poder confirmar su dominio. Se requieren extremos finitos y una primitiva cerrada. No se admiten integrales impropias. Taylor verifica un entorno del centro y calcula derivadas/factoriales; no estima error ni radio de convergencia.

## Gráficos, voz y foco

`CalculationResult.steps` transporta títulos, detalles y fórmulas serializables desde el Worker. `CalculationSteps` ofrece un listado semántico, lectura por paso y lectura completa, usando `MathSpeechFormatter` para las fórmulas. Resultado e historial comparten el componente; las exportaciones incluyen los pasos. La validación del historial admite el campo opcional con hasta 100 pasos.

Las posiciones candidatas de ceros e intersecciones se refinan por bisección, hasta 60 iteraciones, con control de residuo relativo a los extremos del intervalo. Los extremos locales ya acotados por tres muestras se refinan por sección áurea, hasta 48 iteraciones. Son estimaciones locales: no prueban continuidad ni exhaustividad. Los eventos conservan los índices de ambas curvas para la navegación y sonificación; se eliminan duplicados antes de ordenar por X y limitar a 100.

Cada gráfico acepta hasta cuatro funciones reales y conserva sus rangos, modo angular y variables. El Worker genera 401 muestras, cortes heurísticos y hasta 100 eventos aproximados. La exploración por teclado evalúa la coordenada solicitada, sin redondearla al índice de la tabla. El evaluador del punto usa una lista restringida de funciones escalares. El SVG, la tabla, las coordenadas y los eventos ofrecen representaciones complementarias; el muestreo no garantiza detectar todas las discontinuidades.

`useAutomaticSpeech` espera 180 ms para puntero y 140 ms para foco, evita repeticiones por elementos hijos y cancela pendientes con Escape. El usuario activa la voz explícitamente. La guía puede apagarse para usar un lector externo. Los paneles mantienen semántica `details/summary`, las matrices tienen etiquetas de coordenadas y los resultados usan tablas HTML.

Los anuncios de estado usan una región `polite`; los errores del cálculo principal tienen anuncio urgente. Calcular conserva el foco; los errores de entrada vuelven a la expresión. El diálogo nativo de dictado permite editar, confirmar o cancelar y devuelve el foco al botón de origen. No se calcula automáticamente a partir de una transcripción.

## Persistencia y producción

El historial tiene un máximo de 100 entradas y valida los campos estructurados recuperados. Los datos se mantienen en el navegador; no hay sincronización entre dispositivos. Exportar crea un archivo local. El CSV escapa comillas y neutraliza prefijos que las hojas de cálculo podrían interpretar como fórmulas.

`vite-plugin-pwa` genera manifiesto y service worker con Workbox. Precarga recursos de producción, incluidos paneles diferidos y Workers. El modo offline requiere completar la primera carga en HTTPS o localhost. El servidor de desarrollo no ofrece esa garantía. La instalación depende del navegador; el dictado y las voces remotas quedan fuera de la caché.

## Verificación y referencias

Vitest verifica motores, dominios, formateo, persistencia, exportaciones y parser de dictado. Playwright verifica flujos reales de interfaz y usa axe para revisión automática. Una configuración separada comprueba producción sin red. CI ejecuta lint, unitarias, build, navegador y offline. Ver [VALIDATION.md](VALIDATION.md) para evidencia y [ACCESSIBILITY.md](ACCESSIBILITY.md) para pruebas manuales pendientes.

- [Parser y expresiones de Math.js](https://mathjs.org/docs/expressions/parsing.html)
- [Seguridad de expresiones de Math.js](https://mathjs.org/docs/expressions/security.html)
- [Documentación de Nerdamer](https://nerdamer.com/documentation.html)
- [Distribuciones de jStat](https://jstat.github.io/distributions.html)
- [ml-matrix](https://github.com/mljs/matrix)
- [Constantes NIST, CODATA 2022](https://physics.nist.gov/cuu/Constants/Table/allascii.txt)
