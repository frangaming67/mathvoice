# Arquitectura y decisiones previas a la implementación

## Actualización 0.2

Se conserva Math.js para cálculo numérico y se integra Nerdamer 1.1.13 (MIT) detrás de `SymbolicEngine`, dentro del Worker. No se lo considera un motor de resolución general garantizada: se validan AST y argumentos, se rechazan resultados sin resolver, se limita el tiempo y se mantiene un corpus de referencia. Las integrales definidas se limitan a polinomios; los sistemas a ecuaciones lineales con solución única verificada. Desigualdades y series quedan pendientes.

`useAutomaticSpeech` coordina lectura por puntero (180 ms) y foco (140 ms), elimina repeticiones causadas por elementos hijos y cancela pendientes con Escape. No se agregan elementos al orden de Tab para leer texto: el puntero anuncia encabezados y párrafos, mientras el lector externo conserva la semántica HTML. Un botón permanente permite activar o desactivar la voz. La migración de preferencias preserva las opciones anteriores y agrega la lectura por puntero.

`Keypad` ofrece controles numéricos nativos y memoria persistente. `AdvancedCalculator` construye comandos CAS mediante formularios. `MathSpeechFormatter` entiende derivadas, integrales, límites, ecuaciones y soluciones separadas. La interfaz conserva siempre una representación textual del resultado.

## Alcance y bibliotecas

React + TypeScript estricto + Vite. Aplicación cliente de una página, sin backend ni registro. CSS propio, controles HTML nativos y texto matemático siempre disponible. No hace falta renderizado visual especializado en la fase 1.

Math.js: parser, aritmética, funciones científicas y fracciones; posteriormente matrices, vectores, complejos, estadística y unidades. `log(x)` significa base 10 y `ln(x)` logaritmo natural; `log(x,b)` permite otra base. Radianes por defecto. Los modos grados y gradianes afectan trigonometría directa e inversa, no funciones hiperbólicas.

Nerdamer es candidato para álgebra, integrales, límites y ecuaciones (fase 2). Sus módulos documentan esas operaciones, pero antes de integrarlo se validarán mantenimiento, licencia, dominios y casos no resueltos. No se promete que todo problema simbólico tenga solución cerrada. Math.js también proporciona derivación y simplificación; se compararán resultados con un corpus de referencia. Desigualdades y fracciones parciales requieren pruebas específicas antes de habilitarse.

Fuentes consultadas:

- https://mathjs.org/docs/expressions/parsing.html
- https://mathjs.org/docs/expressions/security.html
- https://nerdamer.com/documentation.html

## Separación

`src/services/MathEngine.ts`: entrada validada, AST restringido a operaciones aprobadas, resultados serializables y errores humanos. Sin eval de JavaScript. Cálculo en Worker, con límite de tiempo y reinicio; ninguna operación pesada debe bloquear la navegación.

`src/parser/expression.ts`: normalización de alias españoles; el punto es separador decimal y la coma separa argumentos. No se adivinan comas ambiguas.

`src/accessibility/MathSpeechFormatter.ts`: recorre AST sin calcular. Conserva agrupación y pronuncia operadores y funciones. No depende del adaptador de evaluación.

`src/services/SpeechService.ts`: único propietario de speechSynthesis, selección de voces, velocidad, tono, volumen, repetición, pausa y cancelación. Una locución nueva reemplaza a la anterior para evitar colas largas.

`src/services/StorageService.ts` y `HistoryService.ts`: persistencia versionada, validación y recuperación ante datos corruptos o almacenamiento bloqueado. El historial es local y limitado a 100 entradas.

`src/components/`: formularios, ajustes e historial; `src/features/calculator/`: coordinación de cálculo y estado; `src/accessibility/`: lectura y teclado.

## Contratos

`MathEngine.evaluate(expression, angleMode): CalculationResult` devuelve expresión, resultado, aproximación opcional, tipo y explicación honesta. La UI usa `CalculatorClient.evaluate(): Promise<CalculationResult>` para aislar el Worker. Las operaciones CAS y matrices tendrán contratos separados en sus fases, sin métodos falsos o botones inertes.

`SpeechService`: hablar, detener, pausar, continuar, repetir, cambiarVoz, cambiarVelocidad, cambiarTono, cambiarVolumen. `HistoryService`: cargar, guardar, eliminar, vaciar. `StorageService`: leer y escribir con resultado verificable.

## Modelo accesible

Orden DOM: encabezado, voz/bienvenida, expresión, acciones, resultado, herramientas, historial. Enlace para saltar al cálculo. Botones y etiquetas nativas, fieldsets, details/summary, foco visible. Una región polite para anuncios, una assertive para errores. El resultado no duplica una región viva. Calcular conserva foco; errores de entrada enfocan el campo. No se atrapa Tab fuera de diálogos. Ayuda inline, sin modal innecesario.

Guía voluntaria con lectura de foco opcional. Modo lector externo evita síntesis de voz mientras conserva ARIA. Escape cancela voz. Enter calcula dentro del formulario; Ctrl+Enter lee la expresión. Alt+Shift+R lleva al resultado; Alt+Shift+H al historial; F1 abre ayuda. No se interceptan Ctrl+R/H/L/D/I/G/M del navegador. Atajos modificados pueden variar con SO/lector: todas las funciones tienen botones equivalentes.

Temas claro, oscuro, contraste, blanco/negro y amarillo/negro. Tamaño y espaciado ajustables. Controles de al menos 44 px, diseño desde 320 px y sin animación requerida.

## Limitaciones y pruebas

Web Speech puede requerir gesto inicial, voces pueden llegar asincrónicamente o no existir. No se promete voz offline si el sistema no tiene una instalada. Dictado en fase 5 deberá advertir que el proveedor del navegador puede procesar audio remotamente. No se certifica WCAG sin auditoría manual y usuarios reales.

Vitest: operaciones, modos angulares, fracciones, entradas inválidas, AST hablado y persistencia. Playwright + axe: navegación por teclado, flujo principal, ayuda, errores, historial, vistas móviles y auditoría automática. Matriz manual: NVDA/Chrome, JAWS/Edge y VoiceOver/Safari, zoom 200/400%, voz real y solo teclado. Build TypeScript y ESLint obligatorios por entrega.
