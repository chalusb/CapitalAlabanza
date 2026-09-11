const MODEL = "@cf/myshell-ai/melotts";
const MAX_TEXT = 2000;

function error(message, status) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/tts") {
      if (url.pathname.startsWith("/api/")) return error("Ruta no disponible.", 404);
      return env.ASSETS.fetch(request);
    }
    if (request.method !== "POST") return error("Utiliza POST para solicitar la lectura.", 405);
    // Reject browser requests originating on a different site.
    const origin = request.headers.get("Origin");
    if ((origin && origin !== url.origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") {
      return error("Solicita la lectura desde la página de Alabanzas.", 403);
    }
    if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
      return error("La solicitud debe contener JSON.", 415);
    }
    // Bound the streamed body too: Content-Length may be absent or untrusted.
    let body;
    try {
      const reader = request.body?.getReader();
      if (!reader) return error("Falta el texto para leer.", 400);
      const chunks = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16000) {
          await reader.cancel();
          return error("El texto es demasiado largo. Lee un versículo a la vez.", 413);
        }
        chunks.push(value);
      }
      body = JSON.parse(await new Blob(chunks).text());
    } catch {
      return error("No se pudo interpretar la solicitud.", 400);
    }
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text || text.length > MAX_TEXT) return error("Envía un texto de entre 1 y 2000 caracteres.", 400);
    if (!env.AI) return error("Falta activar Workers AI en Cloudflare con el nombre AI.", 503);

    try {
      // Explicit Spanish is essential: MeloTTS defaults to English.
      const result = await env.AI.run(MODEL, { prompt: text, lang: "es" });
      let audio;
      if (result instanceof Response) {
        if (!result.ok || !(result.headers.get("content-type") || "").startsWith("audio/")) {
          throw new Error("Invalid audio response");
        }
        audio = result.body;
      } else if (result instanceof ReadableStream || result instanceof ArrayBuffer || ArrayBuffer.isView(result)) {
        audio = result;
      } else if (typeof result?.audio === "string" && result.audio.length) {
        audio = Uint8Array.from(atob(result.audio), c => c.charCodeAt(0));
      } else {
        throw new Error("Missing audio");
      }
      return new Response(audio, { headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      } });
    } catch (cause) {
      const quota = /quota|daily|neuron|limit|429/i.test(String(cause?.message || cause));
      return error(quota
        ? "Se alcanzó el límite de voz de Cloudflare. Intenta más tarde; puedes seguir leyendo el texto."
        : "Cloudflare no pudo generar la voz. Intenta nuevamente en unos momentos.", quota ? 429 : 502);
    }
  }
};
