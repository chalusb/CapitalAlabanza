# Alabanzas — reproductor para Fire TV

Sitio web estático (sin backend) para seleccionar 3-5 videos de alabanza y
reproducirlos seguidos, a pantalla completa, navegable con el control remoto
del Fire TV (abriendo el navegador Silk propio del Fire TV, sin laptop).

## Cómo funciona

- `index.html` + `css/style.css` + `js/app.js`: toda la app.
- `videos.json`: catálogo de videos seleccionables. Cada entrada es
  `{ "id", "titulo", "url" }`. `url` debe apuntar al archivo de video alojado
  en Cloudflare R2 (ver abajo).
- `config.json`: video de intro fijo (`{ "intro": "url" }`). Si tiene una URL
  válida, ese video se reproduce siempre primero, automáticamente, antes de
  los que selecciones cada miércoles — no aparece en la cuadrícula de
  selección. Si la URL no carga (por ejemplo, mientras dice el placeholder
  de ejemplo), el sitio lo salta solo y sigue con tu selección normal.
- No hay base de datos ni login: para agregar un video nuevo, subes el archivo
  a R2 y agregas una línea a `videos.json`.

## 1. Subir los videos a Cloudflare R2

Usamos un subdominio de un dominio que ya tienes en Cloudflare
(`cssoftware.org`, apuntado a Railway para la app principal) para alojar los
videos — un subdominio es independiente de lo que apunte la raíz del
dominio, así que no afecta nada de lo que ya está en Railway.

1. En el dashboard de Cloudflare, ve a **R2** y crea un bucket (si no existe
   ya), por ejemplo `alabanzas`.
2. Sube ahí tus 19 archivos `.mp4` **nombrados exactamente igual que el
   `id` de cada entrada en `videos.json`** (por ejemplo
   `alaba-a-dios-danny-berrios.mp4`), más `intro.mp4`.
3. En el bucket, ve a **Settings > Custom Domains > Connect Domain** y
   escribe `alabanzascapital.cssoftware.org`. Cloudflare crea el registro
   DNS solo — no hay que tocar nada de lo que ya está configurado para
   Railway.
4. Listo: cada video queda en
   `https://alabanzascapital.cssoftware.org/<id>.mp4`.

## 2. Editar el catálogo

`videos.json` ya tiene cargadas las 19 alabanzas de `D:\Musica\Alabanzas`,
cada una con la URL apuntando a
`https://alabanzascapital.cssoftware.org/<id>.mp4`. En cuanto subas los
archivos a R2 con esos mismos nombres, empieza a funcionar solo — no hay
que tocar `videos.json` para esto.

Si agregas una alabanza nueva más adelante, el patrón es el mismo:

```json
[
  { "id": "firme-en-tu-amor", "titulo": "Firme en tu amor", "url": "https://alabanzascapital.cssoftware.org/firme-en-tu-amor.mp4" }
]
```

`id` puede ser cualquier texto único (sin espacios es más fácil, y debe
coincidir con el nombre del archivo que subas a R2). `titulo` es lo que se
muestra en el botón grande.

### Video de intro (opcional)

En `tools/render-intro/` está la animación del logo armándose (HTML/CSS +
Playwright) usada para generar `assets/intro.mp4`. Para regenerarla (por
ejemplo si cambias el texto):

```bash
cd tools/render-intro
npm install
npx playwright install chromium
node render.js
# convierte el webm grabado a mp4 con el ffmpeg que trae ffmpeg-static
```

Una vez tengas el `intro.mp4` final, súbelo a R2 igual que los demás videos
(`config.json` ya apunta a
`https://alabanzascapital.cssoftware.org/intro.mp4`).

## 3. Desplegar en Vercel (gratis)

1. Crea una cuenta en https://vercel.com/signup (puedes usar tu cuenta de
   GitHub).
2. Sube esta carpeta a un repositorio de GitHub (o usa `vercel` CLI para
   desplegar directo sin GitHub, si prefieres).
3. En Vercel: **Add New > Project**, importa el repo. Framework preset:
   **Other** (es un sitio estático, no necesita build).
4. Deploy. Vercel te da una URL tipo `https://tu-proyecto.vercel.app`. Si
   tienes dominio propio, lo conectas en **Settings > Domains**.
5. Cada vez que hagas `git push` con cambios (por ejemplo, un video nuevo en
   `videos.json`), Vercel redespliega solo.

## 4. Usarlo en el Fire TV

1. En el Fire TV, abre el navegador **Silk** (o instala uno desde la tienda
   de Amazon si no lo tienes).
2. Escribe la URL de tu sitio (o guárdala como marcador/página de inicio para
   no tener que escribirla cada miércoles).
3. Navega con las flechas del control remoto entre los videos y selecciona
   4 (se numeran en el orden que los toques). El botón dice "Selecciona N
   más" mientras falten, y al tocar el cuarto el foco salta solo al botón
   "Reproducir" — solo hay que darle OK. Se pone en pantalla completa y
   corre uno tras otro.
4. Con el botón de "Atrás"/"Back" del control puedes salir de la reproducción
   en cualquier momento y regresar a la pantalla de selección.

## Notas técnicas

- No hace falta build ni `npm install`: son archivos estáticos puros.
- Si el segundo video no arranca solo en algún navegador de TV muy viejo, es
  por bloqueo de autoplay encadenado; normalmente Silk lo permite porque el
  usuario ya "activó" la reproducción con el botón inicial.
- El límite práctico son los ~10GB gratis de R2 y el ancho de banda de
  Vercel (que aquí casi no se usa, porque los videos se sirven desde R2, no
  desde Vercel).
