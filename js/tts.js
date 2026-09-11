// On-demand Cloudflare speech: one reusable MP3 player for Fire TV.
(function () {
  "use strict";
  var audio = new Audio();
  var active = null;
  var unlocked = false;

  function stop() {
    var job = active;
    active = null;
    audio.onplaying = audio.onended = audio.onerror = audio.onwaiting = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    if (job) {
      clearTimeout(job.timer);
      if (job.controller) job.controller.abort();
      if (job.url) URL.revokeObjectURL(job.url);
    }
  }
  function unlock() {
    if (unlocked) return;
    // Start a short silent WAV in the actual OK/click gesture for TV autoplay.
    var buffer = new ArrayBuffer(2044), view = new DataView(buffer);
    function word(offset, value) {
      for (var i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    }
    word(0, "RIFF"); view.setUint32(4, 2036, true); word(8, "WAVEfmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    word(36, "data"); view.setUint32(40, 2000, true);
    var bytes = new Uint8Array(buffer), binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    audio.src = "data:audio/wav;base64," + btoa(binary);
    var promise = audio.play();
    if (promise && promise.then) promise.then(function () { unlocked = true; }).catch(function () {});
  }
  function speakText(text, options) {
    options = options || {};
    stop();
    unlock();
    var job = { controller: window.AbortController ? new AbortController() : null };
    active = job;
    function fail(error) {
      if (active !== job) return;
      stop();
      if (options.onError) options.onError(error);
    }
    function waitForAudio() {
      clearTimeout(job.timer);
      job.timer = setTimeout(function () {
        fail(new Error("El audio tardó demasiado en cargar. Intenta de nuevo."));
      }, 60000);
    }
    waitForAudio();
    var request = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
      cache: "no-store"
    };
    if (job.controller) request.signal = job.controller.signal;
    fetch("/api/tts", request).then(function (response) {
      if (!response.ok) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          throw new Error(data.error || "No se pudo generar la voz. Intenta nuevamente.");
        });
      }
      if (!(response.headers.get("Content-Type") || "").includes("audio/")) {
        throw new Error("El servicio de voz todavía no está activo en este sitio.");
      }
      return response.blob();
    }).then(function (blob) {
      if (active !== job) return;
      if (!blob.size) throw new Error("El servicio devolvió un audio vacío. Intenta nuevamente.");
      job.url = URL.createObjectURL(blob);
      audio.src = job.url;
      var started = false;
      audio.onplaying = function () {
        if (active !== job) return;
        clearTimeout(job.timer);
        if (started) { if (options.onResume) options.onResume(); return; }
        started = true;
        if (options.onStart) options.onStart();
      };
      audio.onwaiting = function () {
        if (active !== job) return;
        waitForAudio();
        if (options.onBuffer) options.onBuffer();
      };
      audio.onended = function () {
        if (active !== job) return;
        stop();
        if (options.onEnd) options.onEnd();
      };
      audio.onerror = function () { fail(new Error("No se pudo cargar el audio. Revisa la conexión e intenta de nuevo.")); };
      var promise = audio.play();
      if (promise && promise.catch) promise.catch(function () {
        fail(new Error("No se pudo iniciar el audio. Pulsa Leer nuevamente con el control."));
      });
    }).catch(fail);
    return { stop: function () { if (active === job) stop(); } };
  }
  window.speakText = speakText;
  window.stopSpeakText = stop;
})();
