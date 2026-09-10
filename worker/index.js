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
    const origin = request.headers.get("Origin") || request.headers.get("Referer") || "";
    if (!origin.includes(env.ALLOWED_ORIGIN)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return jsonError("Cuerpo invalido, se esperaba JSON.", 400);
  }

  const text = (payload && payload.text ? String(payload.text) : "").trim();
  if (!text) return jsonError("Falta el texto a narrar.", 400);
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonError("El texto es demasiado largo (max " + MAX_TEXT_LENGTH + " caracteres).", 413);
  }

  const voiceId = payload.voiceId || "Lupe";
  const languageCode = payload.languageCode || "es-US";

  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    return jsonError("El servidor no tiene configuradas las credenciales de AWS.", 500);
  }

  const cache = caches.default;
  const cacheKeyUrl = new URL(request.url);
  cacheKeyUrl.search =
    "?v=" + voiceId + "&l=" + languageCode + "&t=" + (await sha256(text));
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const region = env.AWS_REGION || "us-east-1";
  const host = "polly." + region + ".amazonaws.com";
  const body = JSON.stringify({
    Text: text,
    OutputFormat: "mp3",
    VoiceId: voiceId,
    LanguageCode: languageCode,
    Engine: "neural",
    TextType: "text",
  });

  const headers = await signAwsRequest({
    method: "POST",
    host,
    path: "/v1/speech",
    region,
    service: "polly",
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
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
    var detail = await pollyResponse.text().catch(function () { return ""; });
    return jsonError("Amazon Polly respondio con error (" + pollyResponse.status + ").", 502, detail);
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
  await cache.put(cacheKey, response.clone());

  return response;
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
