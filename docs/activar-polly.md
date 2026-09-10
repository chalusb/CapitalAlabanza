# Activar Amazon Polly para la Biblia

El sitio ya incluye un Worker que sirve la página y `/api/tts`. No se necesita
un segundo Worker, un servidor en AWS ni cambiar el alojamiento de los videos.
El navegador reproduce MP3 y no necesita `speechSynthesis` ni voces instaladas.

## 1. Crear la cuenta de AWS

Entra a https://aws.amazon.com/ y elige crear una cuenta de AWS. Completa el
registro, verificación y los datos de pago que solicite AWS. Debe ser una cuenta
con acceso a la consola de AWS y Amazon Polly, no solamente un perfil Builder ID.
Revisa el plan y las condiciones que te muestre antes de confirmarlo.

Al entrar a la consola, selecciona **US East (N. Virginia) / us-east-1**.
Busca **Amazon Polly**, selecciona motor **Neural**, idioma **Spanish (Mexican)**
y voz **Andrés**. Prueba una frase ahí para comprobar que la cuenta tiene acceso.
No necesitas crear una instancia EC2 ni un bucket S3.

## 2. Crear el permiso y usuario para Cloudflare

1. Abre **IAM → Policies → Create policy → JSON**.
2. Pega el contenido de [polly-policy.json](polly-policy.json).
3. Guarda la política con el nombre `CapitalAlabanzaPolly`.
4. En **IAM → Users → Create user**, usa el nombre `capitalalabanza-polly`.
   Este usuario es para la aplicación; no necesita acceso a la consola.
5. Asigna la política `CapitalAlabanzaPolly` al usuario. Si lo creaste sin ella,
   abre **Permissions → Add permissions → Attach policies directly** y selecciónala.
6. Abre el usuario → **Security credentials → Access keys → Create access key**.
   Si aparece la selección de uso, corresponde a una aplicación fuera de AWS.
7. Guarda **Access key ID** y **Secret access key** en un lugar privado.
   La clave secreta se muestra solo al crearla. No uses claves del usuario raíz,
   no las pegues en el chat ni las subas a GitHub.

Referencias: [políticas IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create-console.html),
[usuarios IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html),
[claves de acceso](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).

## 3. Guardar los secretos en Cloudflare

Abre el panel de Cloudflare → **Workers & Pages → capitalalabanza → Settings →
Variables and Secrets → Add**. Debe ser el Worker del sitio
`alabanzascapital.cssoftware.org`, no el Worker que almacena o sirve los videos.

Agrega estas dos entradas de tipo **Secret**:

| Nombre exacto | Valor |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | Access key ID del usuario IAM |
| `AWS_SECRET_ACCESS_KEY` | Secret access key del mismo usuario |

Guarda con **Deploy**. No necesitas `AWS_SESSION_TOKEN` para estas claves IAM.
Las siguientes variables normales están definidas en `wrangler.jsonc`:

| Variable | Valor |
| --- | --- |
| `AWS_REGION` | `us-east-1` |
| `ALLOWED_ORIGIN` | `https://alabanzascapital.cssoftware.org` |
| `POLLY_VOICE_ID` | `Andres` (sin acento) |
| `POLLY_LANGUAGE_CODE` | `es-MX` |

[Instrucciones de secretos de Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/).

## 4. Publicar y probar

El repositorio incluye el código del Worker y la página. Si el Worker está
conectado a GitHub, verifica que el último despliegue de `main` termine bien.
Para publicación manual desde este proyecto: `npx wrangler login`, seguido de
`npx wrangler deploy`. El login se realiza en tu navegador.

Abre https://alabanzascapital.cssoftware.org en Fire TV y recarga la página.
Prueba Salmos 23: un versículo y después el capítulo completo. La pantalla debe
seguir cada audio; al navegar manualmente, la voz continúa sin mover la pantalla.
Cerrar la Biblia o abrir una alabanza detiene la narración.

- Mensaje de credenciales faltantes: revisa los dos secretos del Worker del sitio.
- Error de Polly 403: revisa las claves y que el usuario tenga la política.
- Error de Polly 400: revisa voz `Andres`, idioma `es-MX` y región `us-east-1`.
- Audio bloqueado: pulsa Leer de nuevo con OK. La reproducción definitiva debe
  comprobarse en el Fire TV de destino.
- La página antigua dice que no hay voz en español: recarga y verifica que el
  despliegue nuevo esté activo.

## Coste y caché

Polly cobra por caracteres generados. La tarifa publicada para Neural fuera de
beneficios gratuitos es USD 16 por millón de caracteres. Los créditos y periodos
gratuitos dependen de la cuenta; no se asume que todo el uso será gratuito.
[Precios oficiales](https://aws.amazon.com/polly/pricing/).

El Worker reutiliza audios cuando están disponibles en la caché de Cloudflare.
Esta caché puede expirar o ser desalojada y no equivale a almacenamiento permanente.
El filtro de Origin evita llamadas desde otras páginas en navegadores, pero no
es autenticación ni un límite de gasto: para una exposición pública grande,
configura límites de solicitudes adecuados en Cloudflare.

## Desarrollo y verificación

El servidor estático en el puerto 8765 sirve la interfaz, pero no ejecuta Polly.
Para probar el endpoint localmente usa `npx wrangler dev --port 8787 --var
ALLOWED_ORIGIN:http://localhost:8787` (en una sola línea). Guarda las claves de
prueba en `.dev.vars` local; ese archivo está excluido de Git y de los assets.
Abre exactamente `http://localhost:8787` para que coincida el Origin.

Pruebas sin credenciales ni consumo de Polly:

- `node --test tests/worker.test.cjs`
- Con el servidor estático encendido: `node tests/bible-audio.cjs` (requiere
  Playwright de tools/render-intro y Microsoft Edge).
- `npx wrangler deploy --dry-run --outdir .wrangler/build`

Las pruebas automatizadas usan audio y AWS simulados. No sustituyen la prueba
real después de activar la cuenta y los secretos.
