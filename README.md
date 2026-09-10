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
La lectura del capítulo sigue en pantalla cada versículo al comenzar a narrarlo.
Mover el control, el puntero, tocar la pantalla o usar la rueda desactiva el
seguimiento durante esa lectura, sin interrumpir la voz. Se activa de nuevo
al iniciar otra lectura del capítulo.

La lectura en voz alta usa la síntesis de voz del navegador y requiere una voz
en español en el dispositivo. Si no está disponible, se muestra un aviso.
La narración usa un tono más grave (pitch 0.7) y un ritmo pausado (rate 0.85).
El timbre y la respuesta a estos ajustes dependen de la voz del dispositivo.
La lectura se detiene al cambiar de texto, cerrar la Biblia, abrir el
reproductor o salir de la página. La compatibilidad de audio debe verificarse
en el Fire TV de destino; no se incluye un servicio externo de audio.

Sirve el proyecto mediante HTTP para permitir la carga del XML y los JSON.

## Narrador por Amazon Polly (`/api/tts`)

Endpoint genérico de texto a voz, independiente de la Biblia — recibe
`{ "text": "..." }` por POST y regresa un MP3. No depende de que el
dispositivo tenga una voz instalada (a diferencia de la síntesis nativa del
navegador), así que funciona igual en cualquier Fire TV.

En el navegador: `window.speakText("texto", { onStart, onEnd, onError })`
(definido en `js/tts.js`).

### Configurar las credenciales de AWS

1. En la consola de AWS, crea un usuario de **IAM** solo para esto (no uses
   tu usuario raíz). Asígnale una política mínima, por ejemplo:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": "polly:SynthesizeSpeech", "Resource": "*" }
     ]
   }
   ```
2. Genera un **Access Key** para ese usuario (Access Key ID + Secret Access Key).
3. Guarda las dos claves como *secrets* del Worker en Cloudflare — **nunca**
   en el repo ni en `wrangler.jsonc`:
   ```bash
   npx wrangler secret put AWS_ACCESS_KEY_ID
   npx wrangler secret put AWS_SECRET_ACCESS_KEY
   ```
   (o desde el dashboard: proyecto → Settings → Variables and Secrets).
4. `AWS_REGION` y `ALLOWED_ORIGIN` ya están en `wrangler.jsonc` como
   variables normales (no secretas) — ajústalas si cambian.

El free tier de Amazon Polly incluye 5,000,000 de caracteres al mes con
voces "Standard" (o 1,000,000 con voces neuronales, las que usamos aquí),
más que suficiente para el uso real de la congregación.
