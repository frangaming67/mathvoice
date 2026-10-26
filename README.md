# MathVoice

**Calculadora científica parlante, en español, pensada para personas ciegas o con baja visión.** Tiene forma de calculadora científica de mano y se usa entera con el teclado, con la voz propia de MathVoice o con un lector de pantalla (NVDA, JAWS, VoiceOver). Calcula desde una suma hasta derivadas, integrales, matrices, estadística, gráficos que se escuchan y una hoja de cálculo. Funciona en el navegador, sin cuenta y también sin conexión.

![MathVoice: la calculadora con su pantalla LCD a la izquierda y el teclado a la derecha](docs/capturas/calculadora.png)

Repositorio: [frangaming67/mathvoice](https://github.com/frangaming67/mathvoice) (privado).

## Índice

1. [Qué hace](#qué-hace)
2. [Instalación paso a paso](#instalación-paso-a-paso)
3. [Primeros pasos](#primeros-pasos)
4. [Cómo se usa](#cómo-se-usa)
5. [Todas las funciones](#todas-las-funciones)
6. [Atajos de teclado](#atajos-de-teclado)
7. [Ejemplos](#ejemplos)
8. [Alcance y límites](#alcance-y-límites)
9. [Privacidad](#privacidad)
10. [Desarrollo y pruebas](#desarrollo-y-pruebas)
11. [Más documentación](#más-documentación)

## Qué hace

- **Una calculadora de mano en la pantalla.** Pantalla LCD con la expresión en forma de libro y el resultado, cruceta, SHIFT, ALPHA, MENU y todas las teclas de una calculadora científica. Cada tecla dice su nombre.
- **Todo dentro de la misma calculadora.** Con **MENU** se elige el modo (matrices, estadística, gráficos, tabla, hoja de cálculo…) y la herramienta aparece en la pantalla; el teclado escribe en ella.
- **Habla matemática en español claro.** «2 a la equis más 1» no se confunde con «2 elevado a equis más 1»; las fracciones se dicen con su nombre («tres cuartos») y los decimales periódicos como tales.
- **Funciona con lectores de pantalla.** Los resultados llegan como MathML (NVDA con MathCAT, JAWS y VoiceOver los leen como matemática y los pasan a braille) y se pueden copiar como LaTeX para un docente.
- **Recorre fórmulas por partes**, como la navegación de MathCAT: entrar al numerador, salir del exponente, ir al segundo término.
- **Muestra el procedimiento** de ecuaciones, derivadas, integrales y más, paso a paso y en voz.
- **Gráficos que se escuchan y se describen**, y que se descargan para imprimir en relieve.
- **Dictado por voz** con revisión obligatoria antes de calcular.
- **Historial** que se recorre con flechas y se exporta (TXT, CSV, JSON y un informe HTML para entregar).
- **Sin conexión y sin cuenta.** Todo se calcula en tu dispositivo.

## Instalación paso a paso

Esta guía es para alguien que nunca instaló un programa de este tipo. Seguí los pasos en orden; cada uno dice qué hacer y cómo saber que salió bien. Se hace una sola vez y lleva unos 15 minutos.

> **Importante:** el repositorio es privado. Para descargarlo, la persona dueña tiene que invitarte desde GitHub (_Settings › Collaborators_) y vos tenés que aceptar la invitación que llega por correo. Necesitás una cuenta gratuita de [GitHub](https://github.com/signup).

### Paso 1. Instalar Node.js (el programa que hace funcionar MathVoice)

1. Entrá a <https://nodejs.org>.
2. Descargá la versión que dice **LTS** (es la recomendada).
3. Abrí el archivo descargado y apretá **Siguiente** en todas las pantallas hasta **Finalizar**. No hace falta cambiar ninguna opción.

### Paso 2. Instalar Git (el programa que descarga el código)

1. Entrá a <https://git-scm.com/downloads> y elegí tu sistema (Windows, macOS o Linux).
2. Abrí el archivo descargado y apretá **Next** (Siguiente) en todas las pantallas hasta **Finish**. Las opciones que vienen marcadas están bien.

En Mac, si al abrir la Terminal te ofrece instalar las «herramientas de línea de comandos», aceptá: eso también instala Git.

### Paso 3. Abrir la terminal

La terminal es una ventana donde se escriben órdenes.

- **Windows:** apretá la tecla Windows, escribí `PowerShell` y apretá Enter.
- **Mac:** apretá Comando + Espacio, escribí `Terminal` y apretá Enter.
- **Linux:** Control + Alt + T.

Para comprobar que los pasos 1 y 2 salieron bien, escribí estas dos órdenes (después de cada una, Enter):

```sh
node --version
git --version
```

Cada una tiene que mostrar un número de versión (por ejemplo `v24.1.0` y `git version 2.47.0`). Si dice «no se reconoce» o «command not found», cerrá la terminal, abrila de nuevo y volvé a probar; si sigue igual, repetí la instalación de ese programa.

### Paso 4. Descargar MathVoice

En la terminal, escribí esta orden y apretá Enter (copiala tal cual):

```sh
git clone -b mejoras-0-5 https://github.com/frangaming67/mathvoice.git
```

- Si pide usuario y contraseña de GitHub, se abre una ventana para iniciar sesión: ingresá con tu cuenta.
- `-b mejoras-0-5` descarga la versión más nueva, con la calculadora completa.
- Sale bien si al final no aparece la palabra `fatal`. Se crea una carpeta llamada `mathvoice` en la carpeta donde estabas (en Windows suele ser `C:\Users\tu-nombre`).

**Sin Git:** también podés entrar a <https://github.com/frangaming67/mathvoice/tree/mejoras-0-5>, apretar el botón verde **Code › Download ZIP**, descomprimir el archivo y usar esa carpeta en el paso 5 (en ese caso no hace falta el paso 2).

### Paso 5. Entrar a la carpeta e instalar lo que necesita

Escribí, una por una:

```sh
cd mathvoice
npm ci
```

- `cd mathvoice` entra a la carpeta descargada. (Si usaste el ZIP, la carpeta se llama `mathvoice-mejoras-0-5`: escribí `cd ` y arrastrá la carpeta a la terminal.)
- `npm ci` descarga las piezas que usa MathVoice. Tarda uno o dos minutos y muestra mucho texto; es normal. Termina cuando vuelve a aparecer el lugar para escribir. Las líneas que dicen `warn` no son un problema.

### Paso 6. Abrir MathVoice

Escribí:

```sh
npm run dev
```

Cuando aparezca una línea como `Local: http://127.0.0.1:5173/`, abrí el navegador (Chrome, Edge, Firefox o Safari) y entrá a:

**<http://127.0.0.1:5173>**

Listo: ya estás usando MathVoice. **No cierres la terminal mientras la uses**: es la que la mantiene funcionando.

### Usarla otra vez otro día

Solo hace falta repetir los pasos 3 y 6, entrando primero a la carpeta:

```sh
cd mathvoice
npm run dev
```

y abrir <http://127.0.0.1:5173>. Para cerrarla, en la terminal apretá **Control + C** (o cerrá la ventana).

### Actualizar a la versión más nueva

En la terminal:

```sh
cd mathvoice
git pull
npm ci
npm run dev
```

### Si algo sale mal

| Qué pasa                                         | Qué hacer                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `node` o `git` «no se reconoce como comando»     | Cerrá y abrí la terminal. Si sigue, reinstalá ese programa (pasos 1 o 2) y reiniciá la computadora.               |
| `fatal: repository not found` al descargar       | No tenés acceso al repositorio privado: pedí la invitación y aceptala (ver «Importante» arriba).                  |
| `npm ci` termina con `ERR!`                      | Revisá que estés dentro de la carpeta (`cd mathvoice`) y que tengas internet; volvé a ejecutarlo.                 |
| `Port 5173 is already in use`                    | Ya está abierta en otra terminal: usá esa, o cerrala y probá de nuevo.                                            |
| El navegador dice «no se puede acceder al sitio» | La terminal con `npm run dev` está cerrada: volvé al paso 6.                                                      |
| No se escucha la voz                             | Revisá el volumen y, en MathVoice, **Configuración › Voz**. La voz depende de las voces instaladas en el sistema. |
| La calculadora se ve en blanco y negro           | Está elegido un tema de alto contraste: **Configuración › Presentación › Tema › Claro**.                          |

### Para publicarla en internet (opcional)

Si querés que otras personas la usen sin instalar nada, generá la versión final:

```sh
npm run build
```

Esto crea la carpeta `dist/`, que se sube a cualquier servicio de páginas web con HTTPS (por ejemplo Netlify o GitHub Pages). Con `npm run preview` podés probar esa versión antes en <http://127.0.0.1:4173>.

### Instalarla como aplicación

Una vez publicada (o probándola con `npm run preview`), el navegador permite instalarla como aplicación y usarla sin internet:

- **Computadora (Chrome o Edge):** en la barra de direcciones, el ícono **Instalar** (o menú › _Instalar MathVoice_).
- **Android (Chrome):** menú › _Agregar a la pantalla principal_.
- **iPhone o iPad (Safari):** botón _Compartir_ › _Agregar a pantalla de inicio_.

El modo sin conexión funciona en la versión publicada (`npm run build`) con HTTPS. Las voces del sistema y el dictado pueden necesitar internet según el navegador.

## Primeros pasos

La primera vez se abre un diálogo de bienvenida con dos opciones:

- **Activar guía por voz:** MathVoice lee cada control, cada tecla y cada resultado con su propia voz. Es la opción si no usás lector de pantalla.
- **Usar mi lector de pantalla:** la lectura queda a cargo de NVDA, JAWS o VoiceOver, para no escuchar dos voces.

Marcá **Hacer el recorrido de primeros pasos** para un tutorial de seis pasos cortos: cada paso se cumple haciendo la acción de verdad (calcular, usar el teclado, abrir MENU, explorar una fórmula) y avanza solo. Se puede volver a hacer desde **Ayuda** (F1) › **Primeros pasos**.

Para empezar ya: escribí `2+3` y presioná **Enter**. El resultado se dice y aparece en la pantalla.

## Cómo se usa

### La página

Todas las pantallas tienen la misma estructura: **Saltar al contenido**, el menú **Secciones** (Calculadora, Herramientas, Historial, Configuración, Ayuda) y el grupo **Voz y orientación** (**Guía por voz**, **¿Dónde estoy?** y **Detener voz**). El título principal y el de la pestaña dicen siempre dónde estás. **Escape** detiene la voz.

### Escribir y calcular

Escribí la operación en el campo **Expresión matemática** (está dentro de la pantalla LCD) y presioná **Enter**. **Control + Enter** la lee antes de calcular. Se escribe como en cualquier calculadora:

- `2+3*4`, `(1+2)/3`, `2^10`, `sqrt(16)`, `sin(30)`, `log(100)`, `ln(e)`, `5!`, `25%`.
- Alias en castellano: `raiz(16)`, `sen(30)`, `tg(45)`, `arcsen(1)`, `mcd(12,18)`, `mcm(4,6)`.
- Símbolos: `√`, `∛`, `²`, `³`, `×`, `÷`, `π`.
- `ans` (o `resultado`) es el resultado anterior. Un operador después de un resultado sigue la cuenta; un número empieza otra.
- Punto decimal y coma entre argumentos (`log(8, 2)`). En Configuración se puede elegir **coma decimal**; entonces los argumentos se separan con `;`.

### El teclado de la calculadora

El teclado es **una sola parada de Tab**: las flechas recorren las teclas y cada una dice su nombre.

- **SHIFT** activa las funciones impresas en dorado y **ALPHA** las letras en rojo; se apagan solas después de una tecla, y los nombres de las teclas cambian mientras están activas.
- Las plantillas (fracción, raíz, potencia, logaritmo en base…) dejan el cursor adentro.
- **S⇔D** alterna fracción y decimal; **ENG** la notación de ingeniería; **°′″** grados, minutos y segundos; **FACT** factores primos; **a b/c** fracción mixta.
- **STO** guarda el resultado en A–F, x, y o M; **RECALL** muestra las variables; **M+** y **M−** usan la memoria; **Ans** y **PreAns** traen resultados anteriores.
- **CALC** pide el valor de cada variable; **SOLVE** resuelve la ecuación escrita; **∫**, **d/dx** y **Σ** piden sus datos en un diálogo.
- La cruceta: **◀ ▶** mueven el cursor y dicen el carácter; **▲ ▼** traen cálculos anteriores.
- **DEL**, **INS**, **UNDO** y **AC** editan; **OFF** apaga la pantalla y **ON** la enciende; **CONST** constantes físicas; **CONV** conversiones; **OPTN** buscador de funciones; **QR** copia el cálculo; **CONFIG** configuración.

### MENU: los modos

**MENU** muestra los quince modos dentro de la pantalla. Se eligen con las teclas 1–9 y A–F o con la cruceta:

| Tecla | Modo                   | Qué hace                                                                                         |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| 1     | Calcular               | La calculadora científica.                                                                       |
| 2     | Complejos              | Números complejos: forma polar y rectangular, conjugado, raíces.                                 |
| 3     | Base-N                 | Binario, octal, decimal, hexadecimal y operaciones de bits.                                      |
| 4     | Matriz                 | Matrices de hasta 6 × 6: determinante, inversa, autovalores, sistemas.                           |
| 5     | Vector                 | Módulo, productos punto y cruz, ángulos y distancias.                                            |
| 6     | Estadística            | Media, mediana, desvío, cuartiles, correlación y regresión.                                      |
| 7     | Distribución           | Normal (también inversa), binomial y Poisson; combinaciones.                                     |
| 8     | Gráficos               | Hasta cuatro funciones para explorar con flechas, voz y sonido.                                  |
| 9     | Tabla                  | Valores de f(x) y g(x) desde un x hasta otro con un paso.                                        |
| A     | Ecuaciones y cálculo   | Ecuaciones, sistemas, desigualdades, derivadas, integrales, límites y Taylor, con procedimiento. |
| B     | Proporción             | La regla de tres: A es a B como X es a D.                                                        |
| C     | Hoja de cálculo        | Cinco columnas y 45 filas con números y fórmulas.                                                |
| D     | Funciones y constantes | Todas las funciones y las constantes físicas para insertar.                                      |
| E     | Variables              | Valores con nombre para usar en otros cálculos.                                                  |
| F     | Conversiones           | Unidades de 12 categorías.                                                                       |

En cada modo la herramienta aparece en la pantalla y **el teclado escribe en ella**: los números y las funciones van al campo donde estás, **=** calcula, **DEL** y **AC** borran, **◀ ▶** mueven el cursor y **▲ ▼** pasan de un campo a otro. También se llega a cada modo desde **Herramientas**.

### El resultado

Debajo de la pantalla está **Resultado**: la operación y el valor (como MathML para el lector de pantalla), la forma exacta o decimal, los avisos y los botones **Escuchar resultado**, **Copiar resultado**, **Copiar como LaTeX**, **Copiar como MathML**, **Explorar resultado**, **Explicar resultado**, **Graficar resultado** (si es una función de x) y **Guardar resultado TXT**. En ecuaciones, derivadas, integrales, Taylor y desigualdades, **Procedimiento paso a paso** muestra y lee cada paso.

### Explorar una fórmula por partes

**Explorar expresión** (o `; X`) abre la fórmula que estás escribiendo; **Explorar resultado** (o `; Z`) el resultado; **Explorar** (o la tecla X) un cálculo del historial.

- **Izquierda / Derecha:** la parte anterior o la siguiente.
- **Abajo:** entrar (al numerador, al exponente, a un término, a un argumento). **Arriba:** salir.
- **Inicio / Fin:** la primera o la última parte. **Espacio** repite.
- **R** resume la parte («Resta de 2 partes: el término 1 es un producto y el término 2, un número»). **P** dice dónde estás («el término 1, dentro del denominador»).
- **Enter** (en la expresión que escribís) deja elegida esa parte en el campo para corregirla. **Escape** cierra.

Con el dedo o el ratón, los botones del explorador hacen lo mismo.

### Ayudas para editar sin mirar

Con la guía por voz, las flechas dicen el carácter a la derecha del cursor y Retroceso dice qué se borró. Al cerrar un paréntesis se avisa qué cierra y cuántos quedan abiertos. `; K` lee bajo el cursor, `; F` desde el cursor hasta el final, `; O` dice dónde está el cursor, `; P` va al paréntesis pareja y `; B` revisa los paréntesis.

### Gráficos

En **Gráficos** escribí hasta cuatro funciones de `x`, una por línea, elegí los rangos y presioná **Graficar funciones**.

- **Explorar gráfico** es un deslizador: las flechas recorren la curva y dicen cada punto; avisa los ceros, máximos, mínimos e intersecciones que cruza. `Z`, `M`, `Shift+M` e `I` saltan al siguiente; `+` y `−` cambian el paso; `S` suena el recorrido y `Espacio` lo pausa; `D` describe el gráfico.
- Debajo del dibujo hay una **descripción en palabras** (dominio, cortes con los ejes, crecimiento, asíntotas, saltos) y una tabla de valores.
- **Ajustar Y a la curva**, acercar y alejar alrededor del punto.
- **Descargar para relieve (SVG):** negro sobre blanco con trazos gruesos, para papel microcapsulado.

### Tabla, Proporción y Hoja de cálculo

- **Tabla:** escribí f(x) (y si querés g(x)), desde, hasta y paso. La tabla se recorre con flechas y cada celda se dice con su x («g de equis en equis igual a 0: no definida»).
- **Proporción:** elegí la forma (A : B = X : D o A : B = C : X) y escribí los tres valores.
- **Hoja de cálculo:** escribí sobre una celda un número o una fórmula (`A1*2`, `suma(A1:A5)`, `promedio(B1:B10)`, `mínimo`, `máximo` o cualquier cuenta) y Enter la guarda y baja. **Copiar hacia abajo** corre las referencias de fila, salvo las fijadas con `$`. La hoja queda guardada.

### Dictado

**Dictar expresión** escucha una frase («derivada de x al cubo», «tres cuartos más un medio») y la muestra para revisarla: solo se calcula con **Confirmar y calcular**. Lo que no entiende queda marcado. El dictado depende del navegador y puede enviar el audio a servidores de su proveedor.

### Historial

Guarda los cálculos en el dispositivo. Es una sola parada de Tab: **flechas** recorren, **Enter** edita, **Espacio** escucha, **C** copia, **X** explora, **R** recalcula y **Suprimir** elimina. Se exporta como TXT, CSV, JSON o un **informe HTML** con las fórmulas y su lectura, para imprimir o entregar.

### Configuración

- **Voz:** idioma, voz, velocidad, tono, volumen, leer al recibir foco y al pasar el puntero.
- **Números:** separador decimal (punto o coma), forma del resultado (automática, decimal, exacta o ambas), formato normal, fijo o científico, cifras, modo real o complejo, modo angular.
- **Presentación:** tema (claro, oscuro, alto contraste, negro y blanco, amarillo sobre negro), tamaño de texto, interlineado, escala general y **modo de máxima accesibilidad**.
- **Lector de pantalla:** matemática como MathML o como texto hablado.
- **Sonidos:** tonos de realimentación con su volumen.

Si en un navegador la calculadora se ve en blanco y negro, es porque tiene elegido un tema de alto contraste: se cambia en **Configuración › Presentación › Tema**.

## Todas las funciones

- **Aritmética:** fracciones exactas, decimales periódicos, porcentaje, potencias, raíces, factorial, valor absoluto, redondeo, parte entera, MCD, MCM, números mixtos.
- **Científica:** trigonometría e inversas en radianes, grados o gradianes; hiperbólicas; logaritmos en cualquier base; exponencial; grados sexagesimales; constantes físicas (NIST/CODATA 2022).
- **Álgebra:** ecuaciones (polinomios de cualquier grado con raíces complejas, trigonométricas), sistemas lineales de 2 a 5 ecuaciones, desigualdades de hasta grado 4, simplificar, factorizar, expandir, fracciones parciales. Una igualdad o desigualdad sin letras se verifica (Verdadero o Falso).
- **Cálculo:** derivadas (también en un punto y de orden hasta 10), integrales indefinidas y definidas, límites (también laterales y al infinito), series de Taylor, sumatorias.
- **Matrices y vectores:** determinante, inversa, traspuesta, rango, autovalores, sistemas; producto punto y cruz, módulo, ángulo, distancia.
- **Complejos:** forma binómica y polar, conjugado, argumento, raíces n-ésimas.
- **Estadística y probabilidad:** media, mediana, moda, desvío, varianza, cuartiles, percentiles, covarianza, correlación, regresión lineal; normal (densidad, acumulada e inversa), binomial y Poisson; combinaciones y permutaciones.
- **Tablas, proporciones y hoja de cálculo.**
- **Conversiones:** 12 categorías de unidades, bases numéricas y operaciones de bits.
- **Gráficos:** hasta cuatro funciones, eventos, descripción textual, sonificación y relieve.

Todos los resultados simbólicos se comprueban numéricamente antes de mostrarse; si algo no se puede confirmar, se explica en lugar de mostrar un resultado dudoso.

## Atajos de teclado

| Atajo                 | Acción                                                                |
| --------------------- | --------------------------------------------------------------------- |
| F1                    | Ayuda                                                                 |
| Enter                 | Calcular                                                              |
| Control + Enter       | Escuchar la expresión                                                 |
| Escape                | Detener la voz                                                        |
| Alt + Shift + C       | Ir a la calculadora                                                   |
| Alt + Shift + R       | Ir al resultado y leerlo                                              |
| Alt + Shift + H       | Historial                                                             |
| Alt + Shift + G       | Gráficos                                                              |
| Alt + Shift + M       | Matrices                                                              |
| Alt + Shift + V       | Dictado                                                               |
| Alt + Shift + E       | ¿Dónde estoy?                                                         |
| Alt + Shift + P       | Paleta de comandos (buscar cualquier función)                         |
| Alt + Shift + K       | Teclado y atajos (referencia completa)                                |
| F2                    | Cambiar entre escritura y teclado matemático                          |
| `; R` / `; X` / `; Z` | Escuchar el resultado / explorar la expresión / explorar el resultado |
| G T / G P / G H       | Ir a Tabla / Proporciones / Hoja de cálculo                           |

La referencia completa, con práctica de teclas y personalización, está en **Ayuda › Teclado y atajos**.

## Ejemplos

| Qué                        | Escribí                                          |
| -------------------------- | ------------------------------------------------ |
| Fracciones exactas         | `1/3 + 1/6`                                      |
| Ecuación                   | `x^2 - 4 = 0` o `solve(x^2-4=0, x)`              |
| Sistema lineal             | `system(x+y=10, x-y=4)`                          |
| Desigualdad                | `x^4 - 5x^2 + 4 < 0`                             |
| Verificar                  | `sqrt(8) = 2*sqrt(2)`                            |
| Derivada de orden 2        | `diff(x^5, x, 2)`                                |
| Integral definida          | `integrate(sin(x), x, 0, pi)`                    |
| Límite                     | `limit(sin(x)/x, x, 0)`                          |
| Taylor de orden 4          | `series(exp(x), x, 0, 4)`                        |
| Sumatoria                  | `sum(x^2, x, 1, 10)`                             |
| Determinante               | `det([[1,2],[3,4]])`                             |
| Producto vectorial         | `cross([1,0,0], [0,1,0])`                        |
| Raíces complejas           | `nthRoots(-1, 2)`                                |
| Resumen estadístico        | `stats([1,2,3,4,5], 1)`                          |
| Normal acumulada / inversa | `normalcdf(1.96, 0, 1)` / `invnorm(0.975, 0, 1)` |
| Tabla de valores           | `tabla(x^2, -3, 3, 1)`                           |
| Variable                   | `radio = 7`, después `pi*radio^2`                |
| Temperatura                | `convert(25, "degC", "degF")`                    |
| Base numérica              | `base("255", 10, 16)`                            |
| Grados sexagesimales       | `12°30'45"`                                      |

## Alcance y límites

- Los sistemas simbólicos admiten de 2 a 5 ecuaciones lineales con solución única; las desigualdades, una variable y grado máximo 4; derivadas y Taylor, órdenes hasta 10. Taylor es una aproximación local sin estimación del error.
- Las integrales definidas necesitan extremos finitos y un dominio que se pueda confirmar; si la primitiva no vale en el intervalo, se da el valor numérico con aviso. El álgebra no garantiza resolver toda ecuación o límite.
- Los gráficos usan 401 puntos: pueden omitir eventos entre muestras. Las unidades de las constantes físicas no se propagan en cuentas compuestas.
- Las pruebas automáticas no certifican WCAG: siguen pendientes pruebas con NVDA, JAWS, VoiceOver y personas ciegas.

## Privacidad

No hay cuenta ni servidor de cálculo: todo se calcula en el navegador. El historial, las preferencias, la memoria, las variables y la hoja de cálculo se guardan en el dispositivo; borrar los datos del sitio los elimina. Solo el dictado puede enviar audio al proveedor de reconocimiento del navegador.

## Desarrollo y pruebas

React 19, TypeScript y Vite; mathjs y Nerdamer para el cálculo (en un Web Worker); Playwright y axe para las pruebas de punta a punta y de accesibilidad; Vitest para las unitarias. Requiere Node.js 22.12 o posterior (CI usa Node.js 24).

```sh
npm ci                        # instalar dependencias
npm run dev                   # servidor de desarrollo en http://127.0.0.1:5173
npm run lint                  # ESLint
npm test                      # pruebas unitarias
npm run build                 # versión de producción en dist/
npm run check:bundle          # controla el tamaño del paquete
npx playwright install chromium
npm run test:e2e              # pruebas de punta a punta con axe
npm run test:pwa              # prueba sin conexión de la versión de producción
```

Estructura principal:

- `src/features/calculator/` — la calculadora y la coordinación de todo.
- `src/calculator/` — teclas, modos del MENU, hoja de cálculo y formas del resultado.
- `src/components/` — cada herramienta y diálogo.
- `src/services/` — motor numérico y simbólico, gráficos, historial, preferencias, voz.
- `src/accessibility/` — lectura matemática en voz, MathML, LaTeX y explorador de expresiones.
- `src/keyboard/` — atajos, paleta de comandos y teclado matemático.
- `tests/` — pruebas de punta a punta.

## Más documentación

- [Qué cambió en la 0.5, cosa por cosa](docs/CAMBIOS-0.5.md)
- [Historial de versiones](CHANGELOG.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Protocolo de accesibilidad](docs/ACCESSIBILITY.md)
- [Validación](docs/VALIDATION.md)
- [Hoja de ruta](docs/ROADMAP.md)

## Licencia

MathVoice es software libre bajo la [licencia MIT](LICENSE): se puede usar, copiar, modificar y compartir, también con fines comerciales, conservando el aviso de copyright. Se ofrece tal cual, sin garantía.
