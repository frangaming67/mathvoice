# MathVoice

Calculadora matemática en español con lectura por voz, navegación por teclado y herramientas para trabajar sin depender del gráfico visual.

La entrega **0.3** incorpora herramientas de las cinco fases del [requisito original](docs/REQUISITOS-ORIGINALES.txt): cálculo básico y científico; álgebra y cálculo simbólico; matrices, vectores, complejos y estadística; gráficos explorables; dictado, conversores, exportaciones y uso sin conexión. El [plan por fases](docs/ROADMAP.md) distingue lo implementado de las limitaciones y validaciones pendientes.

Repositorio: [frangaming67/mathvoice](https://github.com/frangaming67/mathvoice) (privado).

La versión **0.4** amplía las fases 2 y 4: procedimientos con fórmulas, lectura de pasos y eventos de gráficos refinados. Los procedimientos se guardan con cada cálculo y se incluyen en las exportaciones.

## Empezar

Después de calcular una ecuación, derivada, integral, Taylor o desigualdad, abrí **Procedimiento paso a paso** en el resultado o el historial. Podés escuchar cada paso, escuchar todos o pasar el puntero sobre su texto y fórmula con la voz automática activa. Para ecuaciones lineales y cuadráticas se muestra el despeje o la fórmula; otras ecuaciones muestran la transformación y las verificaciones disponibles.

En **Puntos importantes y descripción textual** del gráfico, **Ir a este punto** selecciona la curva, ubica la coordenada y lleva el foco a **Explorar gráfico**. Las intersecciones nombran ambas funciones. Los rangos de Y informados describen las muestras, no los extremos globales de la función.

En Configuración podés ampliar toda la interfaz entre 100% y 200%; se conserva al volver a abrir la aplicación. Si hay una actualización de la PWA, aparece **Aplicar actualización y recargar**. El botón **Graficar resultado** carga una expresión compatible en el panel de gráficos. **Guardar resultado TXT** descarga el resultado actual.

En la primera visita se abre un diálogo de bienvenida con el foco adentro: **Activar guía por voz** hace que MathVoice lea cada control y cada resultado; **Usar mi lector de pantalla** deja la lectura a NVDA, JAWS o VoiceOver para no escuchar dos voces. Como el navegador necesita un gesto para habilitar el audio, la primera tecla que presiones en ese diálogo explica las opciones en voz alta. En las visitas siguientes el foco arranca directamente en el campo de expresión.

Todas las pantallas tienen la misma estructura: **Saltar al contenido**, el menú **Secciones** (Calculadora, Herramientas, Historial, Configuración y Ayuda) y el grupo **Voz y orientación** (el interruptor **Guía por voz**, **¿Dónde estoy?** y **Detener voz**). El título principal y el de la pestaña dicen siempre dónde estás. **Herramientas** es una lista que se recorre con las flechas y se abre con Enter; dentro de cada herramienta, la ubicación «Herramientas › Matrices» permite volver. **Ayuda** (F1) reúne los atajos esenciales en una tabla, la paleta de comandos, el modo teclado matemático y **Teclado y atajos**, con la referencia completa en tablas por categoría. Escape cancela la voz y las lecturas pendientes. Configuración permite ajustar idioma y voz, velocidad, tono, volumen, lectura de foco y lectura de puntero.

Escribí una expresión o usá el teclado numérico. Un operador después del resultado continúa la cuenta; un número inicia otra. MC, MR, M+ y M− guardan memoria local. Los enlaces a herramientas abren sus formularios. El historial permite escuchar, copiar, editar, recalcular, eliminar y exportar TXT, CSV o JSON.

Usá punto para decimales y coma entre argumentos. `log` es base 10; `ln` es natural. Los modos radianes, grados y gradianes afectan la calculadora numérica y los gráficos. El cálculo simbólico usa radianes.

## Calculadora de mano

![MathVoice con forma de calculadora científica: pantalla LCD, cruceta y teclado](docs/capturas/calculadora.png)

La pantalla principal es una calculadora científica como las de mano: pantalla LCD con la expresión en forma de libro y el resultado, cruceta, **SHIFT** (funciones impresas en dorado) y **ALPHA** (variables en rojo). El teclado es una sola parada de Tab y se recorre con las flechas; cada tecla dice su nombre, también con Shift o Alpha activos.

- **S⇔D** alterna fracción y decimal; **ENG** y **←** recorren la notación de ingeniería; **°′″** pasa a grados, minutos y segundos; **FACT** descompone en primos; **a b/c** muestra la fracción mixta.
- **STO** guarda el resultado en A–F, x, y o M; **RECALL** muestra las variables; **M+** y **M−** usan la memoria; **Ans** y **PreAns** traen los resultados anteriores.
- **CALC** pregunta el valor de cada variable; **SOLVE** resuelve la ecuación escrita; **∫**, **d/dx** y **Σ** piden sus datos en un diálogo.
- La cruceta trae cálculos anteriores (▲ ▼) y mueve el cursor (◀ ▶); **INS**, **UNDO**, **DEL** y **AC** editan; **OFF** apaga la pantalla y **ON** la enciende.
- **MENU** abre los modos dentro de la pantalla (con las teclas 1–9 y A–F, o con la cruceta): Calcular, Complejos, Base-N, Matriz, Vector, Estadística, Distribución, Gráficos, Tabla, Ecuaciones y cálculo, Proporción, Hoja de cálculo, Funciones y constantes, Variables y Conversiones.

**Tabla** calcula f(x) y g(x) desde un x hasta otro con un paso; la tabla se recorre con las flechas y cada celda se dice con su x. **Proporción** resuelve la regla de tres (A : B = X : D). **Hoja de cálculo** tiene cinco columnas y 45 filas: escribí sobre una celda un número o una fórmula (`A1*2`, `suma(A1:A5)`, `promedio(B1:B10)`) y Enter la guarda; **Copiar hacia abajo** corre las referencias de fila, salvo las fijadas con `$`. **Distribución** incluye la normal inversa. Las desigualdades se escriben sueltas (`x^2-4>0`) hasta grado 4, y una igualdad o desigualdad sin letras se verifica: `sqrt(2) > 1.4` da Verdadero.

## Ejemplos

| Herramienta                   | Expresión                                     |
| ----------------------------- | --------------------------------------------- |
| Fracciones exactas            | `fraction(1,3)+fraction(1,6)`                 |
| Número mixto                  | `mixed(fraction(7,3))` o `mixedNumber(2,1,3)` |
| Ecuación                      | `solve(x^2-4=0,x)`                            |
| Sistema lineal                | `system(x+y=10,x-y=4)`                        |
| Desigualdad                   | `inequality(x^2-4<=0,x)`                      |
| Derivada de orden 2           | `diff(x^5,x,2)`                               |
| Integral definida             | `integrate(sin(x),x,0,pi)`                    |
| Límite                        | `limit(sin(x)/x,x,0)`                         |
| Taylor de orden 4             | `series(exp(x),x,0,4)`                        |
| Determinante                  | `det([[1,2],[3,4]])`                          |
| Producto vectorial            | `cross([1,0,0],[0,1,0])`                      |
| Raíces complejas              | `nthRoots(-1,2)`                              |
| Resumen estadístico muestral  | `stats([1,2,3,4,5],1)`                        |
| Distribución normal acumulada | `normalcdf(1.96,0,1)`                         |
| Normal inversa                | `invnorm(0.975,0,1)`                          |
| Tabla de valores              | `tabla(x^2,-3,3,1)`                           |
| Desigualdad de grado 4        | `x^4-5x^2+4<0`                                |
| Variable persistente          | `radio=7`, después `pi*radio^2`               |
| Temperatura                   | `convert(25,"degC","degF")`                   |
| Base numérica                 | `base("255",10,16)`                           |

En **Gráficos**, ingresá hasta cuatro funciones de `x`, una por línea. Configurá los rangos y pulsá **Graficar funciones**. En **Explorar gráfico**, las flechas izquierda y derecha avanzan por el paso elegido; Inicio y Fin van a los extremos. Hay coordenadas habladas, tabla de valores, eventos aproximados y un recorrido sonoro. Escape detiene el audio.

**Dictar expresión** abre una revisión editable: el cálculo solo se ejecuta con **Confirmar y calcular**. El reconocimiento disponible depende del navegador y puede procesar audio en servidores de su proveedor. La interpretación de frases es limitada; revisá siempre lo entendido.

## Alcance matemático

Los sistemas simbólicos admiten entre 2 y 5 ecuaciones lineales con solución única. Las desigualdades admiten una variable y grado máximo 4 (se pueden escribir sueltas, como x^2-4>0; sin letras, se verifican); las derivadas órdenes 1–10 y Taylor órdenes 0–10. Taylor produce una aproximación local sin estimar su error ni radio de convergencia.

Las integrales definidas requieren extremos finitos, un dominio real continuo que el análisis conservador pueda confirmar y una primitiva cerrada. Se rechazan integrales impropias y también puede rechazarse una integral válida cuyo dominio no pueda verificarse. El CAS no garantiza resolver toda ecuación o límite ni enumerar todas las raíces de ecuaciones trascendentes.

Los gráficos usan 401 puntos y detección aproximada: pueden omitir eventos o discontinuidades entre muestras. Las constantes físicas muestran unidades y fuente NIST/CODATA 2022, pero sus unidades no se propagan en cálculos compuestos. Las variables almacenadas son números reales finitos.

## Desarrollo y pruebas

Requiere Node.js 22.12 o posterior; CI usa Node.js 24.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run check:bundle
npx playwright install chromium
npm run test:e2e
npm run test:pwa
```

`test:pwa` compila y prueba la versión de producción: activa el service worker, desconecta la red, recarga y usa cálculo, matrices, CAS y gráficos. `npm run preview` sirve el build local. El modo sin conexión se habilita en producción después de la primera carga completa; requiere HTTPS o localhost. La instalación depende del soporte del navegador. Las voces y el dictado pueden necesitar conexión aunque los cálculos estén disponibles.

La aplicación no requiere cuenta ni backend. Historial, preferencias, memoria y variables se guardan en el navegador; borrar sus datos elimina ese contenido. No se envían expresiones a un servicio de cálculo.

Ver [arquitectura](docs/ARCHITECTURE.md), [validación](docs/VALIDATION.md) y [protocolo de accesibilidad](docs/ACCESSIBILITY.md). Las pruebas automáticas no certifican WCAG: siguen pendientes pruebas con NVDA, JAWS, VoiceOver y personas ciegas.
