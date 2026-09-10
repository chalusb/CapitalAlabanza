# Alabanzas — Comunidad Capital

Sitio en HTML, CSS y JavaScript con un Worker de Cloudflare para servir la página
y generar la voz de la Biblia mediante Amazon Polly.

La sección desplegable **Biblia** carga el XML RVR1960 incluido. El flujo es
libro → capítulo → versículo; muestra todo el capítulo y posiciona la pantalla
sobre el versículo elegido. Las flechas y OK permiten usarlo con el control de TV.

Los botones superiores leen el versículo seleccionado o el capítulo completo.
La narración del capítulo anuncia la referencia solo al principio. Sigue cada
versículo al empezar su audio; cualquier navegación manual detiene el seguimiento
sin cortar la voz. Cerrar la Biblia, cambiar de vista o detener cancela el audio.

La voz usa MP3 de Polly mediante `/api/tts`, no las voces del navegador. Se usa
Andrés, español de México, motor Neural y ritmo al 90 %. Las voces Neural de Polly
no admiten ajustar pitch; el timbre proviene de la voz elegida.

**Activación desde cero:** [cuenta AWS, permisos y secretos de Cloudflare](docs/activar-polly.md).

`js/tts.js` ofrece `window.speakText(text, { onStart, onEnd, onError })` y
`window.stopSpeakText()`. Reutiliza un reproductor, cancela solicitudes pendientes,
libera los archivos de audio temporales y reporta errores del servicio.

La configuración está en `wrangler.jsonc`; las credenciales se guardan como
secretos del Worker. El XML conserva su aviso de derechos original.
