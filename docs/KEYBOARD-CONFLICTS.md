# Criterios de teclado y conflictos

Revisión documental: 8 de octubre de 2026. Se contrastaron las asignaciones de MathVoice con las fuentes oficiales indicadas abajo. No se realizaron pruebas con lectores de pantalla reales; la compatibilidad con NVDA, JAWS y VoiceOver sigue IMPLEMENTADA PERO PENDIENTE DE VERIFICACIÓN.

## Fuentes primarias consultadas

- [NVDA: navegación por una sola letra](https://download.nvaccess.org/documentation/en/userGuide.html#SingleLetterNavigation).
- [JAWS: teclas y modos](https://www.freedomscientific.com/training/jaws/hotkeys/).
- [VoiceOver: modificadores y paso de una tecla a la aplicación](https://support.apple.com/en-gb/guide/voiceover/vo2722/mac).
- [VoiceOver: Quick Nav con flechas y teclas individuales](https://support.apple.com/guide/voiceover/quick-nav-vo27943/mac).
- [Chrome](https://support.google.com/chrome/answer/157179?hl=en), [Edge](https://support.microsoft.com/en-us/edge/keyboard-shortcuts-in-microsoft-edge), [Firefox](https://support.mozilla.org/en-US/kb/keyboard-shortcuts-perform-firefox-tasks-quickly) y [Safari](https://support.apple.com/guide/safari/keyboard-shortcuts-and-gestures-cpsh003/mac).
- [Windows](https://support.microsoft.com/en-au/accessibility/windows/keyboard-shortcuts-in-windows), [cambio de idioma de teclado en Windows](https://support.microsoft.com/en-us/office/languages/using-right-to-left-languages-in-office), [teclas de función de macOS](https://support.apple.com/en-ca/102439) y [atajos de macOS](https://support.apple.com/en-us/102650).

## Conflictos confirmados y decisiones aplicadas

| Combinación | Uso documentado fuera de MathVoice | Decisión |
| --- | --- | --- |
| Alt+Shift+T | Enfocar una barra de Chrome o Edge | Se retiró el acceso global a herramientas y se reservó la combinación. |
| Alt+Shift+I | Abrir comentarios al navegador en Chrome o Edge | Se retiró el acceso global a integrales y se reservó la combinación. |
| Alt+Shift+A | Enfocar un diálogo inactivo en Chrome | Reservada; no se admite en personalización ni importación. |
| Alt+Shift+B | Enfocar la barra de favoritos en Edge | Reservada; no se admite en personalización ni importación. |
| Alt+Shift+N | Abrir vista dividida en Chrome | Reservada; no se admite en personalización ni importación. |
| Shift+Escape | Administrador de tareas de Chrome o Firefox | Reservada; MathVoice deja pasar el evento. |
| F8 | Seleccionar una tabla o elemento con JAWS | Reservada; deja de ofrecerse como tecla libre para personalización. |

Las correspondencias de la tabla provienen de [Chrome](https://support.google.com/chrome/answer/157179?hl=en), [Edge](https://support.microsoft.com/en-us/edge/keyboard-shortcuts-in-microsoft-edge), [Firefox](https://support.mozilla.org/en-US/kb/keyboard-shortcuts-perform-firefox-tasks-quickly) y [JAWS](https://www.freedomscientific.com/training/jaws/hotkeys/). Que una prueba de eventos del navegador permita interceptar una combinación no elimina su conflicto con una función documentada del navegador o lector.

No se agregaron reemplazos globales para Alt+Shift+T ni Alt+Shift+I. Las herramientas siguen disponibles en el menú y la paleta; las integrales también en su formulario y mediante la secuencia G I dentro del modo matemático.

Ctrl+Enter conserva la activación nativa de controles como enlaces y botones. En particular, [Firefox](https://support.mozilla.org/en-US/kb/keyboard-shortcuts-perform-firefox-tasks-quickly) y [JAWS](https://www.freedomscientific.com/training/jaws/hotkeys/) documentan su uso para abrir el enlace enfocado en otra pestaña. La lectura de expresión permanece disponible en el contexto de edición de MathVoice y mediante su botón; no se captura fuera de la aplicación.

F1 es una sobrescritura contextual deliberada: abre la ayuda de MathVoice cuando el foco está dentro de la aplicación, aunque [Chrome](https://support.google.com/chrome/answer/157179?hl=en) y [Edge](https://support.microsoft.com/en-us/edge/keyboard-shortcuts-in-microsoft-edge) lo asignan a su propia ayuda. No se presenta como tecla libre de conflictos. F2 cambia de modo. Las demás teclas de función, incluido F8, no se ofrecen para reasignación general.

## Modos de los lectores y alcance de las teclas

La navegación rápida de los lectores utiliza letras, dígitos y puntuación. Por ejemplo, [NVDA](https://download.nvaccess.org/documentation/en/userGuide.html#SingleLetterNavigation) usa dígitos para encabezados y coma para límites de contenedores; [JAWS](https://www.freedomscientific.com/training/jaws/hotkeys/) utiliza punto y coma para elementos con respuesta al puntero, además de letras y números. Esto afecta también a los prefijos de secuencias de MathVoice, no solo a los comandos de una letra. [VoiceOver Quick Nav](https://support.apple.com/guide/voiceover/quick-nav-vo27943/mac) puede consumir tanto teclas individuales como flechas.

MathVoice no intenta suprimir esos modos ni aplica `role="application"` a la página. Los comandos matemáticos requieren activación expresa y foco en su área de trabajo. El usuario debe configurar el lector para pasar las teclas que quiera usar; los formularios y la paleta permiten trabajar sin esos comandos. La documentación de los lectores describe sus mecanismos: NVDA+F2 para pasar la próxima tecla, Insert+3 en JAWS de escritorio y VO+Tab en VoiceOver. Las combinaciones dependen de la distribución y configuración del lector.

La barra de división `/` también inicia búsqueda rápida en [Firefox](https://support.mozilla.org/en-US/kb/keyboard-shortcuts-perform-firefox-tasks-quickly). Su interpretación matemática queda limitada al área y modo matemático. Las flechas, Inicio/Fin y Espacio conservan su significado nativo fuera de los controles de MathVoice que documentan una función específica para ellas.

## Personalización y protección de edición

Se conservan los atajos de edición en inputs, textarea, select y contenido editable, incluidos Ctrl+Z/Y, selección y movimiento del cursor. No se capturan Meta/Command, Ctrl+Alt, AltGr, Insert ni Caps Lock como modificadores del lector. Alt+D y las combinaciones de Alt destinadas a menús, dirección o sistema permanecen reservadas. Estas exclusiones protegen comandos documentados de [Windows](https://support.microsoft.com/en-au/accessibility/windows/keyboard-shortcuts-in-windows) y [macOS](https://support.apple.com/en-us/102650), incluidos los modificadores de [VoiceOver](https://support.apple.com/en-gb/guide/voiceover/vo2722/mac).

Las asignaciones con Shift y un dígito o signo de puntuación se rechazan porque no corresponden al evento que normaliza MathVoice. Se usa el carácter producido: para sumar se asigna `+`, aunque el teclado físico requiera Shift para escribirlo. Las combinaciones como Shift+D conservan el modificador y siguen siendo distintas de D.

Los perfiles y mapas importados deben validar conflictos por contexto. La misma tecla puede asignarse a funciones de matrices y gráficos porque esos contextos se excluyen. Un atajo global no puede colisionar con ninguno. La restauración exige confirmación y una importación inválida conserva íntegra la configuración anterior.

## Condiciones del entorno y evidencia pendiente

En Windows, Alt+Shift puede cambiar el idioma cuando hay varios teclados configurados, según la [documentación de Microsoft](https://support.microsoft.com/en-us/office/languages/using-right-to-left-languages-in-office). Esto es una condición del entorno; no demuestra que cualquier combinación Alt+Shift+letra produzca ese cambio. No se modifican las preferencias del sistema para hacer funcionar un atajo.

En Mac puede ser necesario Fn para enviar una tecla F, según la [configuración de teclas de función](https://support.apple.com/en-ca/102439). [Safari](https://support.apple.com/guide/safari/keyboard-shortcuts-and-gestures-cpsh003/mac) también condiciona el recorrido completo con Tab a sus ajustes de navegación por teclado. Las asignaciones personales del sistema o lector pueden introducir otros conflictos.

Esta revisión verifica correspondencias documentadas y decisiones del código. No demuestra qué eventos entrega una instalación concreta ni que una persona pueda completar el recorrido con su lector. Siguen pendientes las pruebas reales con NVDA + Chrome/Edge, JAWS + Chrome/Edge y VoiceOver + Safari, registrando versiones, distribución de teclado, modos y configuración utilizados.
