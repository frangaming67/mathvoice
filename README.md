# MathVoice

Entorno matemático en español, pensado para trabajar sin mirar la pantalla.

## Desarrollo por fases

Versión **0.2**: calculadora con teclado numérico, lectura automática al pasar el puntero o enfocar controles, memoria persistente y funciones de álgebra y cálculo.

Repositorio: https://github.com/frangaming67/mathvoice (privado).

## Usar la calculadora

Activá **Activar voz automática** una vez: después se leen los botones, campos y textos al recorrerlos con el puntero o Tab. El navegador necesita esa interacción inicial para permitir audio. Escape cancela tanto la locución como lecturas pendientes. Podés apagar la voz desde la barra superior, y controlar por separado lectura de foco y puntero en Configuración.

El teclado incluye números, operaciones, paréntesis, porcentaje, borrar, cambio de signo, cuadrado, igual y memoria MC/MR/M+/M−. Después de calcular, un operador continúa desde el resultado y un número empieza otra operación. M+/M− guardan el último resultado numérico, con persistencia local.

En **Álgebra y cálculo** podés usar formularios para resolver ecuaciones y sistemas lineales, simplificar, expandir, factorizar, descomponer en fracciones parciales, sustituir, derivar (incluidas parciales y órdenes 1–10), integrar y calcular límites. También podés escribir:

```text
solve(x^2-4=0,x)
system(x+y=10,x-y=4)
diff(x^5,x,2)
integrate(2*x,x)
integrate(x^2,x,0,5)
limit(sin(x)/x,x,0)
substitute(x^2+3*x,x,2)
```

Las integrales indefinidas incluyen `+ C`. Las definidas admiten polinomios por ahora; los sistemas admiten entre 2 y 5 ecuaciones lineales con solución única. El CAS usa radianes independientemente del modo de la calculadora numérica. `log` es base 10, `ln` es natural. El motor simbólico no garantiza resolver todas las ecuaciones o límites; una operación no resuelta produce un mensaje, no un falso resultado.

## Fases del proyecto

1. Arquitectura, cálculo básico y científico, voz, accesibilidad e historial.
2. Álgebra, ecuaciones, derivadas, integrales y límites.
3. Matrices, vectores, complejos y estadística.
4. Gráficos SVG, exploración por teclado y sonificación.
5. Dictado con confirmación, conversiones, PWA y exportaciones.

## Ejecutar

Requiere Node.js 22.12 o posterior.

```sh
npm install
npm run dev
npm run build
npm test
npm run lint
npm run test:e2e
```

Para las pruebas de navegador: `npx playwright install chromium` una vez.

Ver [arquitectura](docs/ARCHITECTURE.md), [plan](docs/ROADMAP.md) y [validación accesible](docs/ACCESSIBILITY.md).

No necesita cuenta ni envía cálculos a servidores. La disponibilidad y calidad de voces depende del navegador y del sistema operativo. Se puede usar sin voz y con un lector externo. La voz comienza después de activarla explícitamente. Aún quedan matrices, vectores, gráficos, dictado, conversiones y PWA; ver el plan para el estado detallado.
