// Narrador generico: convierte texto a audio via el endpoint /api/tts
// (Cloudflare Worker + Amazon Polly) y lo reproduce. No depende de que el
// dispositivo tenga una voz instalada, a diferencia de speechSynthesis.
//
// Uso: window.speakText("texto a narrar", { onEnd: function () {} })
// Regresa un objeto { stop } para poder cancelar la reproduccion.
(function () {
  "use strict";

  var currentAudio = null;

  function stop() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio = null;
    }
  }

  function speakText(text, options) {
    options = options || {};
    stop();

    var audio = new Audio();
    currentAudio = audio;

    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        voiceId: options.voiceId,
        languageCode: options.languageCode,
      }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error("tts-request-failed");
        return response.blob();
      })
      .then(function (blob) {
        if (currentAudio !== audio) return; // se cancelo mientras cargaba
        audio.src = URL.createObjectURL(blob);
        audio.addEventListener("ended", function () {
          if (options.onEnd) options.onEnd();
        });
        audio.play().catch(function () {
          if (options.onError) options.onError();
        });
        if (options.onStart) options.onStart();
      })
      .catch(function () {
        if (currentAudio === audio && options.onError) options.onError();
      });

    return {
      stop: function () {
        if (currentAudio === audio) stop();
      },
    };
  }

  window.speakText = speakText;
  window.stopSpeakText = stop;
})();
