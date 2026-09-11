// On-demand Cloudflare speech with a bounded look-ahead queue for Fire TV.
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
      clearTimeout(job.bufferTimer);
      job.entries.forEach(function (entry) {
        clearTimeout(entry.timer);
        if (entry.controller) entry.controller.abort();
        entry.blob = null;
      });
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
  function speakSequence(texts, options) {
    options = options || {};
    stop();
    unlock();
    var job = {
      entries: texts.map(function (text) { return { text: text, state: "new" }; }),
      current: 0, next: 0, inFlight: 0, playing: -1, initial: true,
      failedAt: texts.length
    };
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
    function fetchEntry(index) {
      var entry = job.entries[index];
      entry.state = "pending";
      entry.controller = window.AbortController ? new AbortController() : null;
      job.inFlight++;
      var request = {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: entry.text }), cache: "no-store"
      };
      if (entry.controller) request.signal = entry.controller.signal;
      function finish(error, blob) {
        if (active !== job || entry.state !== "pending") return;
        clearTimeout(entry.timer);
        entry.state = error ? "error" : "ready";
        entry.error = error;
        entry.blob = blob;
        job.inFlight--;
        if (error) job.failedAt = Math.min(job.failedAt, index);
        pump();
        tryPlay();
      }
      entry.timer = setTimeout(function () {
        if (entry.controller) entry.controller.abort();
        finish(new Error("El audio tardó demasiado en cargar. Intenta de nuevo."));
      }, 60000);
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
        if (!blob.size) throw new Error("El servicio devolvió un audio vacío. Intenta nuevamente.");
        finish(null, blob);
      }).catch(function (error) { finish(error); });
    }
    function pump() {
      // Current verse plus two ahead; at most two synthesis requests at once.
      // Do not generate the whole chapter if the user stops after a few verses.
      var end = Math.min(texts.length, job.current + 3, job.failedAt);
      while (active === job && job.inFlight < 2 && job.next < end) fetchEntry(job.next++);
    }
    function tryPlay() {
      if (active !== job || job.playing === job.current) return;
      var entry = job.entries[job.current];
      if (!entry) { stop(); if (options.onEnd) options.onEnd(); return; }
      if (entry.state === "error") { fail(entry.error); return; }
      if (job.initial) {
        // Build a small cushion before starting, including very short verses.
        var end = Math.min(texts.length, 3, job.failedAt + 1);
        for (var i = 0; i < end; i++) {
          if (job.entries[i].state === "new" || job.entries[i].state === "pending") return;
        }
        job.initial = false;
      }
      if (entry.state !== "ready") {
        if (options.onBuffer) options.onBuffer();
        return;
      }
      job.playing = job.current;
      if (job.url) URL.revokeObjectURL(job.url);
      job.url = URL.createObjectURL(entry.blob);
      entry.blob = null;
      audio.src = job.url;
      waitForAudio();
      var index = job.current;
      var started = false;
      audio.onplaying = function () {
        if (active !== job || job.current !== index) return;
        clearTimeout(job.timer);
        clearTimeout(job.bufferTimer);
        if (started) { if (options.onResume) options.onResume(); return; }
        started = true;
        if (options.onStart) options.onStart(index);
      };
      audio.onwaiting = function () {
        if (active !== job || job.current !== index) return;
        waitForAudio();
        // Loading a ready blob may briefly emit waiting while the decoder starts.
        clearTimeout(job.bufferTimer);
        job.bufferTimer = setTimeout(function () {
          if (active === job && job.current === index && options.onBuffer) options.onBuffer();
        }, 250);
      };
      audio.onended = function () {
        if (active !== job || job.current !== index) return;
        clearTimeout(job.timer);
        clearTimeout(job.bufferTimer);
        job.current++;
        pump();
        tryPlay();
      };
      audio.onerror = function () { fail(new Error("No se pudo cargar el audio. Revisa la conexión e intenta de nuevo.")); };
      var promise = audio.play();
      if (promise && promise.catch) promise.catch(function () {
        fail(new Error("No se pudo iniciar el audio. Pulsa Leer nuevamente con el control."));
      });
    }
    pump();
    tryPlay();
    return { stop: function () { if (active === job) stop(); } };
  }
  function speakText(text, options) {
    return speakSequence([text], options);
  }
  window.speakSequence = speakSequence;
  window.speakText = speakText;
  window.stopSpeakText = stop;
})();
