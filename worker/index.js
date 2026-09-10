import { signAwsRequest } from "./sigv4.js";

const MAX_TEXT_LENGTH = 2500;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/tts") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleTts(request, env);
    }

    // Cualquier otra ruta: servir el sitio estatico normal.
    return env.ASSETS.fetch(request);
  },
};

async function handleTts(request, env) {
  if (env.ALLOWED_ORIGIN) {
    let origin = request.headers.get("Origin");
    try {
      if (!origin) origin = new URL(request.headers.get("Referer")).origin;
    } catch (_) { origin = ""; }
    const allowed = /^https?:\/\//.test(env.ALLOWED_ORIGIN) ? env.ALLOWED_ORIGIN : "https://" + env.ALLOWED_ORIGIN;
    if (origin !== allowed) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return jsonError("Cuerpo invalido, se esperaba JSON.", 400);
  }

  const text = payload && typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) return jsonError("Falta el texto a narrar.", 400);
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonError("El texto es demasiado largo (max " + MAX_TEXT_LENGTH + " caracteres).", 413);
  }

  const voiceId = env.POLLY_VOICE_ID || "Andres";
  const languageCode = env.POLLY_LANGUAGE_CODE || "es-MX";

  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    return jsonError("La lectura aún no está configurada. Faltan las credenciales de Amazon Polly en Cloudflare.", 503);
  }

  const cache = caches.default;
  const cacheKeyUrl = new URL(request.url);
  cacheKeyUrl.search =
    "?version=2&v=" + voiceId + "&l=" + languageCode + "&t=" + (await sha256(text));
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const region = env.AWS_REGION || "us-east-1";
  const host = "polly." + region + ".amazonaws.com";
  const body = JSON.stringify({
    Text: '<speak><prosody rate="90%">' + escapeXml(text) + '</prosody></speak>',
    OutputFormat: "mp3",
    VoiceId: voiceId,
    LanguageCode: languageCode,
    Engine: "neural",
    TextType: "ssml",
  });

  const headers = await signAwsRequest({
    method: "POST",
    host,
    path: "/v1/speech",
    region,
    service: "polly",
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
    body,
    contentType: "application/json",
  });

  let pollyResponse;
  try {
    pollyResponse = await fetch("https://" + host + "/v1/speech", {
      method: "POST",
      headers,
      body,
    });
  } catch (err) {
    return jsonError("No se pudo contactar a Amazon Polly.", 502);
  }

  if (!pollyResponse.ok) {
    return jsonError("Amazon Polly no pudo generar el audio (" + pollyResponse.status + "). Revisa las credenciales, permisos y región del Worker.", 502);
  }

  const audioBuffer = await pollyResponse.arrayBuffer();
  const response = new Response(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=" + CACHE_TTL_SECONDS,
    },
  });

  // Guarda una copia en la cache de Cloudflare para no volver a pagar/llamar
  // a Polly si alguien pide exactamente el mismo texto y voz despues.
  await cache.put(cacheKey, response.clone()).catch(function () {});

  return response;
}

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function jsonError(message, status, detail) {
  return new Response(JSON.stringify({ error: message, detail: detail || undefined }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
