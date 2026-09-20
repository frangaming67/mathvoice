# MathVoice

Calculadora matemática en español con lectura por voz, navegación por teclado y herramientas para trabajar sin depender del gráfico visual.

La entrega **0.3** incorpora herramientas de las cinco fases del [requisito original](docs/REQUISITOS-ORIGINALES.txt): cálculo básico y científico; álgebra y cálculo simbólico; matrices, vectores, complejos y estadística; gráficos explorables; dictado, conversores, exportaciones y uso sin conexión. El [plan por fases](docs/ROADMAP.md) distingue lo implementado de las limitaciones y validaciones pendientes.

Repositorio: [frangaming67/mathvoice](https://github.com/frangaming67/mathvoice) (privado).

La versión **0.4** amplía las fases 2 y 4: procedimientos con fórmulas, lectura de pasos y eventos de gráficos refinados. Los procedimientos se guardan con cada cálculo y se incluyen en las exportaciones.

## Empezar

Después de calcular una ecuación, derivada, integral, Taylor o desigualdad, abrí **Procedimiento paso a paso** en el resultado o el historial. Podés escuchar cada paso, escuchar todos o pasar el puntero sobre su texto y fórmula con la voz automática activa. Para ecuaciones lineales y cuadráticas se muestra el despeje o la fórmula; otras ecuaciones muestran la transformación y las verificaciones disponibles.

En **Puntos importantes y descripción textual** del gráfico, **Ir a este punto** selecciona la curva, ubica la coordenada y lleva el foco a **Explorar gráfico**. Las intersecciones nombran ambas funciones. Los rangos de Y informados describen las muestras, no los extremos globales de la función.

En Configuración podés ampliar toda la interfaz entre 100% y 200%; se conserva al volver a abrir la aplicación. Si hay una actualización de la PWA, aparece **Aplicar actualización y recargar**. El botón **Graficar resultado** carga una expresión compatible en el panel de gráficos. **Guardar resultado TXT** descarga el resultado actual.

Activá **Activar voz automática** una vez. Después se leen los controles al pasar el puntero o recorrerlos con Tab. El navegador necesita esa interacción inicial para habilitar audio. Escape cancela la voz y las lecturas pendientes. Configuración permite ajustar idioma y voz, velocidad, tono, volumen, lectura de foco y lectura de puntero. Si usás un lector de pantalla, podés desactivar la guía para evitar voces simultáneas.

Escribí una expresión o usá el teclado numérico. Un operador después del resultado continúa la cuenta; un número inicia otra. MC, MR, M+ y M− guardan memoria local. Los enlaces a herramientas abren sus formularios. El historial permite escuchar, copiar, editar, recalcular, eliminar y exportar TXT, CSV o JSON.

Usá punto para decimales y coma entre argumentos. `log` es base 10; `ln` es natural. Los modos radianes, grados y gradianes afectan la calculadora numérica y los gráficos. El cálculo simbólico usa radianes.

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
| Variable persistente          | `radio=7`, después `pi*radio^2`               |
| Temperatura                   | `convert(25,"degC","degF")`                   |
| Base numérica                 | `base("255",10,16)`                           |

En **Gráficos**, ingresá hasta cuatro funciones de `x`, una por línea. Configurá los rangos y pulsá **Graficar funciones**. En **Explorar gráfico**, las flechas izquierda y derecha avanzan por el paso elegido; Inicio y Fin van a los extremos. Hay coordenadas habladas, tabla de valores, eventos aproximados y un recorrido sonoro. Escape detiene el audio.

**Dictar expresión** abre una revisión editable: el cálculo solo se ejecuta con **Confirmar y calcular**. El reconocimiento disponible depende del navegador y puede procesar audio en servidores de su proveedor. La interpretación de frases es limitada; revisá siempre lo entendido.

## Alcance matemático

Los sistemas simbólicos admiten entre 2 y 5 ecuaciones lineales con solución única. Las desigualdades admiten una variable y grado máximo 2; las derivadas órdenes 1–10 y Taylor órdenes 0–10. Taylor produce una aproximación local sin estimar su error ni radio de convergencia.

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
