# Validación de accesibilidad

El objetivo es WCAG 2.2 AA y uso independiente sin mirar la pantalla. **No se declara conformidad ni validación con lectores reales.** Axe, las pruebas de teclado y las simulaciones de voz detectan parte de los problemas; no reemplazan evaluación humana.

La aplicación ofrece controles HTML nativos, foco visible, etiquetas, encabezados, salto al cálculo, cinco temas, texto e interlineado ajustables, lectura matemática y guía opcional. La voz requiere una primera activación del usuario. Se puede desactivar para evitar duplicación con un lector externo. Matrices y estadísticas tienen resultados tabulares; los gráficos incluyen coordenadas, tabla y eventos aproximados.

## Matriz manual pendiente

Probar al menos NVDA + Chrome, JAWS + Chrome/Edge y VoiceOver + Safari. Registrar versión del sistema, navegador y lector, voz instalada, configuración, fecha, resultado y problemas. Incluir personas ciegas y con baja visión; la prueba crítica es descubrir, utilizar y comprender cada herramienta sin asistencia visual.

| Área                    | Comprobación manual                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Primer uso              | Reconocer título, bienvenida y opciones de voz; continuar con guía o lector externo                                       |
| Navegación              | Tab/Shift+Tab, encabezados, enlaces de herramientas, nombres y foco visible sin trampas                                   |
| Voz automática          | Activación, puntero, foco, controles dentro de paneles y ausencia de colas/repeticiones; Escape cancela pendientes        |
| Expresiones             | Leer `2*(3+4)`, fracciones, potencias, complejos, matrices y unidades con agrupación comprensible                         |
| Cálculo                 | Calcular `sqrt(25)+sin(pi/2)`; escuchar, repetir, explicar y copiar el resultado                                          |
| Errores                 | Enviar `sqrt(`; confirmar anuncio claro y foco en expresión sin borrar lo escrito                                         |
| Álgebra y cálculo       | Resolver ecuación, desigualdad, derivada, integral y Taylor; distinguir resultado, aproximación y limitación              |
| Matrices                | Identificar fila/columna/valor; usar flechas, Tab y bordes; leer inversa y error por matriz singular                      |
| Estadística y variables | Entender muestra/población, tablas, asignación y eliminación de variables                                                 |
| Gráficos                | Explorar sin mirar: función elegida, paso, coordenadas, Inicio/Fin, eventos y tabla; detener audio con Escape             |
| Sonificación            | Comprobar volumen cómodo, distinción entre altura y eventos y correspondencia con la tabla; evaluar utilidad con usuarios |
| Dictado                 | Permitir o negar micrófono; revisar, editar, escuchar, confirmar y cancelar; Escape y retorno de foco del diálogo         |
| Historial y exportación | Buscar, editar, recalcular, copiar, eliminar y confirmar vaciado; descargar y leer cada formato                           |
| Visual y móvil          | Cinco temas, texto grande, interlineado, zoom real 200/400%, ancho 320 px, orientación y tablas desplazables              |
| Condiciones adversas    | Voz ausente, lector externo, almacenamiento bloqueado, sin red y navegador sin dictado                                    |
| Instalación             | Abrir PWA instalada, reiniciar, cambiar conectividad y conservar controles/lectura                                        |

Los tests automáticos simulan síntesis y reconocimiento para comprobar la lógica; no validan calidad acústica, pronunciación real, comprensión del dictado ni experiencia con un micrófono físico. El modo offline de cálculo tampoco prueba voces offline.

## Atajos implementados

Además de los atajos de la tabla, Alt+Shift+G abre gráficos; M abre matrices; D y L seleccionan derivada y límite; V inicia o cancela dictado. Alt+Shift+P abre la paleta; K, la referencia; E anuncia «¿Dónde estoy?». F2 cambia entre escritura y teclado matemático. Integral y menú de herramientas siguen disponibles en la paleta y formularios; Alt+Shift+I/T se reservan al navegador. Estos accesos respetan un diálogo abierto y conservan alternativas mediante controles visibles. [Conflictos y fuentes consultadas](KEYBOARD-CONFLICTS.md).

| Tecla                                 | Acción                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Enter en un formulario                | Ejecutar su acción                                                         |
| Ctrl+Enter en un campo o área matemática | Escuchar expresión; conserva activación nativa sobre botones/enlaces       |
| Escape                                | Detener voz y sonificación; cancelar el diálogo de dictado si está abierto |
| Alt+Shift+R                           | Enfocar resultado                                                          |
| Alt+Shift+H                           | Enfocar historial                                                          |
| F1                                    | Abrir ayuda                                                                |
| Flechas en una matriz                 | Moverse entre celdas                                                       |
| Izquierda/derecha en Explorar gráfico | Moverse por el paso elegido                                                |
| Inicio/Fin en Explorar gráfico        | Ir a extremos del rango                                                    |

No se interceptan Ctrl+R/H/L/D/I/G/M del navegador. Los atajos pueden entrar en conflicto con el sistema o lector; comprobar cada combinación y usar controles equivalentes disponibles. La voz inglesa seleccionable no traduce los textos españoles de la interfaz.

## Registro de cada incidencia

Anotar tarea intentada, pasos, comportamiento esperado/observado, combinación de lector y navegador, impacto en uso independiente y evidencia. Volver a probar la corrección en la misma combinación. No cerrar una incidencia de percepción o comprensión solo porque axe o Playwright pasen.
