# Alabanzas — Comunidad Capital

Sitio web estático hecho en HTML, CSS y JavaScript puro (sin frameworks ni
backend) para esta solución.

La sección desplegable **Biblia**, debajo de las alabanzas, carga
`data/bible-rvr1960.xml` al abrirse. Incluye los 66 libros de la Reina-Valera
1960 y conserva el aviso de derechos del XML proporcionado.

Con el control remoto: flechas para mover el foco, OK para elegir libro,
capítulo y versículo, y Atrás para regresar un paso. También hay botones
para volver, cerrar y cambiar al versículo anterior o siguiente del capítulo.
Al elegir un versículo se muestra el capítulo completo, con el versículo
elegido resaltado y visible. Arriba y abajo recorren el texto; OK lleva a los
controles de lectura, ubicados arriba del texto. Hay dos botones: **Leer
versículo seleccionado** y **Leer capítulo completo** (desde el versículo 1).
El botón activo permite detener la lectura; elegir el otro cambia de modo.

La lectura en voz alta usa la síntesis de voz del navegador y requiere una voz
en español en el dispositivo. Si no está disponible, se muestra un aviso.
La narración usa un tono más grave (pitch 0.7) y un ritmo pausado (rate 0.85).
El timbre y la respuesta a estos ajustes dependen de la voz del dispositivo.
La lectura se detiene al cambiar de texto, cerrar la Biblia, abrir el
reproductor o salir de la página. La compatibilidad de audio debe verificarse
en el Fire TV de destino; no se incluye un servicio externo de audio.

Sirve el proyecto mediante HTTP para permitir la carga del XML y los JSON.
