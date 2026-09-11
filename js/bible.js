(function () {
  "use strict";
  var names = "Génesis|Éxodo|Levítico|Números|Deuteronomio|Josué|Jueces|Rut|1 Samuel|2 Samuel|1 Reyes|2 Reyes|1 Crónicas|2 Crónicas|Esdras|Nehemías|Ester|Job|Salmos|Proverbios|Eclesiastés|Cantares|Isaías|Jeremías|Lamentaciones|Ezequiel|Daniel|Oseas|Joel|Amós|Abdías|Jonás|Miqueas|Nahúm|Habacuc|Sofonías|Hageo|Zacarías|Malaquías|Mateo|Marcos|Lucas|Juan|Hechos|Romanos|1 Corintios|2 Corintios|Gálatas|Efesios|Filipenses|Colosenses|1 Tesalonicenses|2 Tesalonicenses|1 Timoteo|2 Timoteo|Tito|Filemón|Hebreos|Santiago|1 Pedro|2 Pedro|1 Juan|2 Juan|3 Juan|Judas|Apocalipsis".split("|");
  var toggle = document.getElementById("bible-toggle");
  var panel = document.getElementById("bible-panel");
  var content = document.getElementById("bible-content");
  var status = document.getElementById("bible-status");
  var books, loading = false, step = "books", book = 0, chapter = 0, verse = 0;
  var utterance = null, readingMode = null;
  var followReading = false;
  function setAudioLoading(busy) {
    status.classList.toggle("audio-loading", busy);
    content.querySelectorAll("#bible-read, #bible-read-chapter").forEach(function (button) {
      var selected = readingMode === (button.id === "bible-read" ? "verse" : "chapter");
      button.classList.toggle("is-loading", busy && selected);
      button.setAttribute("aria-busy", busy && selected ? "true" : "false");
      if (selected) button.textContent = busy ? "Cancelar carga" : "Detener lectura";
    });
  }

  function pauseFollowing() {
    if (readingMode === "chapter") followReading = false;
  }
  // Capture input before spatial navigation moves focus. Do not listen to
  // scroll itself: scrolling performed by the reader must not cancel following.
  document.addEventListener("keydown", function (event) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", "Tab", " "].indexOf(event.key) !== -1) pauseFollowing();
  }, true);
  ["wheel", "touchstart", "pointerdown", "pointermove"].forEach(function (type) {
    document.addEventListener(type, pauseFollowing, { capture: true, passive: true });
  });

  function button(label, action, parent) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = "btn bible-choice";
    el.textContent = label;
    el.addEventListener("click", action);
    (parent || content).appendChild(el);
    return el;
  }
  function stopReading() {
    setAudioLoading(false);
    var wasReading = !!utterance;
    utterance = null;
    readingMode = null;
    followReading = false;
    content.querySelectorAll(".is-reading").forEach(function (item) { item.classList.remove("is-reading"); });
    if (wasReading && window.stopSpeakText) window.stopSpeakText();
    var read = document.getElementById("bible-read");
    if (read) read.textContent = "Leer versículo seleccionado";
    var readChapter = document.getElementById("bible-read-chapter");
    if (readChapter) readChapter.textContent = "Leer capítulo completo";
    status.textContent = "";
  }
  function focusChoice(index) {
    var choices = content.querySelectorAll(".bible-grid button");
    var target = choices[index || 0] || content.querySelector("button");
    if (target && !panel.hidden) target.focus();
  }
  function back() {
    if (step === "reading") { step = "verses"; render(verse); }
    else if (step === "verses") { step = "chapters"; render(chapter); }
    else if (step === "chapters") { step = "books"; render(book); }
    else close();
  }
  function close() {
    stopReading();
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.querySelector("span").textContent = "＋";
    toggle.focus();
  }
  function render(selected) {
    stopReading();
    content.textContent = "";
    var heading = document.createElement("h2");
    heading.textContent = step === "books" ? "¿Qué libro quieres leer?" :
      step === "chapters" ? names[book] + " · Elige un capítulo" :
      step === "verses" ? names[book] + " " + (chapter + 1) + " · Elige un versículo" :
      names[book] + " " + (chapter + 1) + ":" + (verse + 1);
    content.appendChild(heading);
    button(step === "books" ? "Cerrar Biblia" : "← Volver", back);
    if (step === "reading") {
      var text = document.createElement("div");
      text.id = "bible-text";
      text.setAttribute("aria-label", names[book] + " " + (chapter + 1));
      books[book][chapter].forEach(function (words, index) {
        var passage = document.createElement("p");
        passage.className = "bible-verse";
        passage.tabIndex = 0;
        passage.dataset.verse = String(index + 1);
        var number = document.createElement("span");
        number.className = "bible-verse-number";
        number.textContent = String(index + 1) + " ";
        passage.appendChild(number);
        passage.appendChild(document.createTextNode(words));
        passage.addEventListener("focus", function () {
          if (verse !== index && readingMode !== "chapter") stopReading();
          verse = index;
          text.querySelectorAll(".bible-verse").forEach(function (item, i) {
            item.classList.toggle("is-selected", i === verse);
            if (i === verse) item.setAttribute("aria-current", "true");
            else item.removeAttribute("aria-current");
          });
          heading.textContent = names[book] + " " + (chapter + 1) + ":" + (verse + 1);
          prev.disabled = verse === 0;
          next.disabled = verse === books[book][chapter].length - 1;
        });
        passage.addEventListener("click", function () { passage.focus(); });
        passage.addEventListener("keydown", function (event) {
          // OK brings the reading controls into reach even in a long chapter.
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            (read.disabled ? content.querySelector("button") : read).focus();
          }
        });
        text.appendChild(passage);
      });
      content.appendChild(text);
      var actions = document.createElement("div");
      actions.className = "bible-actions";
      content.insertBefore(actions, text);
      var prev = button("← Anterior", function () { text.children[verse - 1].focus(); }, actions);
      prev.disabled = verse === 0;
      var read = button("Leer versículo seleccionado", function () { readAloud("verse"); }, actions);
      read.id = "bible-read";
      var readChapter = button("Leer capítulo completo", function () { readAloud("chapter"); }, actions);
      readChapter.id = "bible-read-chapter";
      if (!window.speakText) {
        read.disabled = true;
        readChapter.disabled = true;
        status.textContent = "Este navegador no permite leer en voz alta. Puedes seguir leyendo el texto.";
      }
      var next = button("Siguiente →", function () { text.children[verse + 1].focus(); }, actions);
      next.disabled = verse === books[book][chapter].length - 1;
      if (!panel.hidden) {
        var selectedPassage = text.children[verse];
        selectedPassage.focus();
        selectedPassage.scrollIntoView({ block: "center" });
      }
      return;
    }
    var grid = document.createElement("div");
    grid.className = "bible-grid" + (step === "books" ? " bible-books" : "");
    content.appendChild(grid);
    var items = step === "books" ? names : step === "chapters" ? books[book] : books[book][chapter];
    items.forEach(function (_, index) {
      button(step === "books" ? names[index] : String(index + 1), function () {
        if (step === "books") { book = index; step = "chapters"; }
        else if (step === "chapters") { chapter = index; step = "verses"; }
        else { verse = index; step = "reading"; }
        render();
      }, grid);
    });
    focusChoice(selected);
  }
  function readAloud(mode) {
    if (utterance && readingMode === mode) { stopReading(); return; }
    stopReading();
    readingMode = mode;
    followReading = mode === "chapter";
    var verses = books[book][chapter];
    var index = mode === "chapter" ? 0 : verse;
    var last = mode === "chapter" ? verses.length - 1 : verse;
    // Speak one verse at a time so long chapters do not become one huge utterance.
    function speakNext() {
      var current = {};
      current.onstart = function () {
        if (utterance !== current || mode !== "chapter") return;
        var passages = content.querySelectorAll(".bible-verse");
        passages.forEach(function (item, i) { item.classList.toggle("is-reading", i === index); });
        if (followReading && passages[index]) {
          passages[index].focus({ preventScroll: true });
          passages[index].scrollIntoView({ block: "center", behavior: "auto" });
        }
      };
      current.onend = function () {
        if (utterance !== current) return;
        if (index < last) { index++; speakNext(); }
        else stopReading();
      };
      current.onerror = function (error) {
        if (utterance !== current) return;
        stopReading();
        status.textContent = error && error.message ? error.message : "No se pudo iniciar la lectura. Intenta de nuevo.";
      };
      utterance = current;
      document.getElementById(mode === "chapter" ? "bible-read-chapter" : "bible-read").textContent = "Detener lectura";
      setAudioLoading(true);
      status.textContent = "Preparando tu lectura…";
      window.speakText(verses[index], {
        book: book + 1, chapter: chapter + 1, verse: index + 1,
        onStart: function () {
          if (utterance !== current) return;
          setAudioLoading(false);
          status.textContent = "Leyendo versículo " + (index + 1) + (mode === "chapter" ? " de " + verses.length : "") + "…";
          current.onstart();
        }, onBuffer: function () {
          if (utterance !== current) return;
          setAudioLoading(true);
          status.textContent = "Cargando audio…";
        }, onResume: function () {
          if (utterance !== current) return;
          setAudioLoading(false);
          status.textContent = "Leyendo versículo " + (index + 1) + "…";
        }, onEnd: current.onend, onError: current.onerror
      });
    }
    speakNext();
  }
  function load() {
    if (loading) return;
    loading = true;
    content.textContent = "";
    status.textContent = "Cargando Biblia…";
    fetch("data/bible-rvr1960.xml").then(function (response) {
      if (!response.ok) throw new Error("No se pudo cargar la Biblia");
      return response.text();
    }).then(function (source) {
      var xml = new DOMParser().parseFromString(source, "application/xml");
      var nodes = xml.querySelectorAll("book");
      if (xml.querySelector("parsererror") || nodes.length !== names.length) throw new Error("XML inválido");
      books = Array.prototype.map.call(nodes, function (node) {
        return Array.prototype.map.call(node.querySelectorAll("chapter"), function (ch) {
          return Array.prototype.map.call(ch.querySelectorAll("verse"), function (v) { return v.textContent.trim(); });
        });
      });
      render();
    }).catch(function () {
      status.textContent = "No se pudo cargar la Biblia. Revisa la conexión y vuelve a intentarlo.";
      button("Reintentar", load);
    }).then(function () { loading = false; });
  }
  toggle.addEventListener("click", function () {
    if (!panel.hidden) { close(); return; }
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.querySelector("span").textContent = "−";
    if (books) render(); else load();
  });
  document.addEventListener("keydown", function (event) {
    if (panel.hidden || !document.getElementById("view-selection").classList.contains("active")) return;
    if (["Escape", "Backspace", "GoBack", "BrowserBack"].indexOf(event.key) !== -1) {
      event.preventDefault();
      back();
    }
  });
  document.addEventListener("app:viewchange", stopReading);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stopReading(); });
  window.addEventListener("pagehide", stopReading);
})();
