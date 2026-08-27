(function () {
  "use strict";

  var views = {
    selection: document.getElementById("view-selection"),
    player: document.getElementById("view-player"),
    end: document.getElementById("view-end"),
  };

  var grid = document.getElementById("grid");
  var playBtn = document.getElementById("play-btn");
  var clearBtn = document.getElementById("clear-btn");
  var shuffleBtn = document.getElementById("shuffle-btn");
  var video = document.getElementById("video-player");
  var controlsEl = document.getElementById("player-controls");
  var playerStatus = document.getElementById("player-status");
  var replayBtn = document.getElementById("replay-btn");
  var prevBtn = document.getElementById("prev-btn");
  var pauseBtn = document.getElementById("pause-btn");
  var pauseIcon = document.getElementById("pause-icon");
  var nextBtn = document.getElementById("next-btn");
  var closeBtn = document.getElementById("close-btn");
  var seekBar = document.getElementById("seek-bar");
  var progressTime = document.getElementById("progress-time");
  var likeBtn = document.getElementById("like-btn");
  var siteFooter = document.getElementById("site-footer");

  video.volume = 1;
  video.muted = false;

  var REQUIRED_SELECTIONS = 4;
  var HIDE_CONTROLS_DELAY = 2000;

  var ICON_PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
  var ICON_PLAY = '<path d="M8 5v14l11-7z"/>';

  var allVideos = [];
  var selectedOrder = []; // array of video ids, in the order clicked
  var playQueue = [];
  var playIndex = 0;
  var introUrl = null;
  var controlsVisible = false;
  var hideTimer = null;

  function showView(name) {
    Object.keys(views).forEach(function (key) {
      views[key].classList.toggle("active", key === name);
    });
    siteFooter.style.display = name === "player" ? "none" : "";
  }

  likeBtn.addEventListener("click", function () {
    likeBtn.classList.toggle("liked");
  });

  function loadVideos() {
    fetch("config.json", { cache: "no-store" })
      .then(function (res) {
        return res.ok ? res.json() : {};
      })
      .catch(function () {
        return {};
      })
      .then(function (config) {
        introUrl = config && config.intro ? config.intro : null;
      })
      .then(function () {
        return fetch("videos.json", { cache: "no-store" });
      })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        allVideos = data;
        renderGrid();
      })
      .catch(function (err) {
        grid.innerHTML =
          '<p style="color:#e88; font-size:1.4vw;">No se pudo cargar videos.json: ' +
          err.message +
          "</p>";
      });
  }

  function renderGrid() {
    grid.innerHTML = "";
    allVideos.forEach(function (v) {
      var card = document.createElement("button");
      card.className = "video-card";
      card.type = "button";
      card.dataset.id = v.id;
      card.innerHTML =
        '<span class="badge"></span><span class="title">' + v.titulo + "</span>";
      card.addEventListener("click", function () {
        toggleSelect(v.id, card);
      });
      grid.appendChild(card);
    });
    updatePlayButton();
  }

  function toggleSelect(id, card) {
    var idx = selectedOrder.indexOf(id);
    if (idx === -1) {
      if (selectedOrder.length >= REQUIRED_SELECTIONS) return;
      selectedOrder.push(id);
    } else {
      selectedOrder.splice(idx, 1);
    }
    refreshBadges();
    updatePlayButton();
    if (selectedOrder.length === REQUIRED_SELECTIONS) {
      playBtn.focus();
    }
  }

  function refreshBadges() {
    var cards = grid.querySelectorAll(".video-card");
    cards.forEach(function (card) {
      var id = card.dataset.id;
      var pos = selectedOrder.indexOf(id);
      var badge = card.querySelector(".badge");
      if (pos === -1) {
        card.classList.remove("selected");
        badge.textContent = "";
      } else {
        card.classList.add("selected");
        badge.textContent = String(pos + 1);
      }
    });
  }

  function updatePlayButton() {
    var remaining = REQUIRED_SELECTIONS - selectedOrder.length;
    playBtn.disabled = remaining !== 0;
    playBtn.textContent =
      remaining <= 0
        ? "▶ Reproducir"
        : "Selecciona " + remaining + " más";
  }

  clearBtn.addEventListener("click", function () {
    selectedOrder = [];
    refreshBadges();
    updatePlayButton();
  });

  playBtn.addEventListener("click", function () {
    if (selectedOrder.length !== REQUIRED_SELECTIONS) return;
    beginPlayback(selectedOrder);
  });

  shuffleBtn.addEventListener("click", function () {
    if (allVideos.length === 0) return;
    beginPlayback(pickRandomIds(REQUIRED_SELECTIONS));
  });

  function pickRandomIds(count) {
    var pool = allVideos.map(function (v) {
      return v.id;
    });
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, count);
  }

  function beginPlayback(ids) {
    playQueue = ids
      .map(function (id) {
        return allVideos.find(function (v) {
          return v.id === id;
        });
      })
      .filter(Boolean);
    if (introUrl) {
      playQueue.unshift({ id: "__intro__", titulo: "Intro", url: introUrl });
    }
    playIndex = 0;
    showView("player");
    startPlayback();
  }

  function startPlayback() {
    setControlsVisible(false);
    clearHideTimer();
    playCurrent();
    requestFullscreenSafe(views.player);
  }

  function playCurrent() {
    if (playIndex < 0) playIndex = 0;
    if (playIndex >= playQueue.length) {
      finishPlayback();
      return;
    }
    var item = playQueue[playIndex];
    playerStatus.textContent =
      "Reproduciendo " + (playIndex + 1) + " de " + playQueue.length + ": " + item.titulo;
    seekBar.value = 0;
    seekBar.max = 0;
    updateProgressDisplay(0, 0);
    video.src = item.url;
    video.volume = 1;
    video.muted = false;
    var playPromise = video.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {
        /* Autoplay del segundo+ video puede requerir un toque si el navegador lo bloquea */
      });
    }
  }

  video.addEventListener("ended", function () {
    playIndex += 1;
    playCurrent();
  });

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function updateProgressDisplay(current, duration) {
    var pct = duration ? (current / duration) * 100 : 0;
    seekBar.style.setProperty("--fill-pct", pct + "%");
    progressTime.textContent = formatTime(current) + " / " + formatTime(duration);
  }

  video.addEventListener("loadedmetadata", function () {
    seekBar.max = video.duration || 0;
  });

  video.addEventListener("timeupdate", function () {
    if (!video.duration) return;
    seekBar.value = video.currentTime;
    updateProgressDisplay(video.currentTime, video.duration);
  });

  // Arrastrar la barra (mouse, touch o flechas izquierda/derecha con el
  // control remoto una vez que esta enfocada) adelanta o retrasa el video.
  seekBar.addEventListener("input", function () {
    if (!video.duration) return;
    video.currentTime = seekBar.valueAsNumber;
    updateProgressDisplay(seekBar.valueAsNumber, video.duration);
  });

  // Izquierda/derecha en la barra deja que el navegador la mueva (nativo).
  // Arriba/abajo navega a otros controles en vez de cambiar el valor.
  seekBar.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.stopPropagation();
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    var focusables = Array.prototype.slice.call(
      views.player.querySelectorAll("button, [tabindex], input[type='range']")
    );
    var next = findNearest(seekBar, e.key, focusables);
    if (next) {
      e.preventDefault();
      e.stopPropagation();
      next.focus();
    }
  });

  // ---------- Controles estilo Netflix: ocultos, el primer toque del
  // control remoto pausa y los revela; al reanudar, se ocultan solos. ----------

  function setControlsVisible(visible) {
    controlsVisible = visible;
    controlsEl.classList.toggle("visible", visible);
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer = setTimeout(function () {
      setControlsVisible(false);
    }, HIDE_CONTROLS_DELAY);
  }

  function revealControls() {
    video.pause();
    setControlsVisible(true);
    clearHideTimer();
    pauseBtn.focus();
  }

  video.addEventListener("play", function () {
    pauseIcon.innerHTML = ICON_PAUSE;
    scheduleHide();
  });

  video.addEventListener("pause", function () {
    pauseIcon.innerHTML = ICON_PLAY;
    clearHideTimer();
  });

  video.addEventListener("click", function () {
    if (!controlsVisible) {
      revealControls();
    } else if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  });

  prevBtn.addEventListener("click", function () {
    playIndex -= 1;
    playCurrent();
  });

  nextBtn.addEventListener("click", function () {
    playIndex += 1;
    playCurrent();
  });

  pauseBtn.addEventListener("click", function () {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  });

  closeBtn.addEventListener("click", function () {
    stopPlaybackToSelection();
  });

  video.addEventListener("error", function () {
    // Si un video de la cola no carga (p.ej. la URL del intro aun no
    // se configuro en config.json), no se traba: pasa al siguiente.
    playIndex += 1;
    playCurrent();
  });

  function finishPlayback() {
    exitFullscreenSafe();
    showView("end");
    replayBtn.focus();
  }

  function stopPlaybackToSelection() {
    video.pause();
    video.removeAttribute("src");
    video.load();
    clearHideTimer();
    setControlsVisible(false);
    exitFullscreenSafe();
    showView("selection");
  }

  replayBtn.addEventListener("click", function () {
    selectedOrder = [];
    refreshBadges();
    updatePlayButton();
    likeBtn.classList.remove("liked");
    showView("selection");
    if (grid.firstChild) grid.firstChild.focus();
  });

  function requestFullscreenSafe(el) {
    var req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;
    if (req) {
      req.call(el).catch(function () {
        /* algunos navegadores de TV no soportan Fullscreen API; el video ya ocupa toda la pantalla */
      });
    }
  }

  function exitFullscreenSafe() {
    var exit =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen;
    if (exit && document.fullscreenElement) {
      exit.call(document).catch(function () {});
    }
  }

  // Escape / Atras (control remoto) durante la reproduccion -> regresar a seleccion
  document.addEventListener("keydown", function (e) {
    if (
      views.player.classList.contains("active") &&
      (e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack")
    ) {
      e.preventDefault();
      stopPlaybackToSelection();
    }
  });

  // Primer toque del control remoto mientras los controles estan ocultos:
  // pausa y los revela, en vez de mover el foco de una vez (estilo Netflix).
  var REVEAL_KEYS = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Enter",
    " ",
    "MediaPlayPause",
  ];
  document.addEventListener("keydown", function (e) {
    if (
      views.player.classList.contains("active") &&
      !controlsVisible &&
      REVEAL_KEYS.indexOf(e.key) !== -1
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      revealControls();
    }
  });

  // ---------- Navegacion espacial simple para control remoto (flechas) ----------
  document.addEventListener("keydown", function (e) {
    var dirs = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (dirs.indexOf(e.key) === -1) return;
    var active = document.activeElement;
    var container = active && active.closest ? active.closest(".view.active") : null;
    if (!container) return;
    var focusables = Array.prototype.slice.call(
      container.querySelectorAll("button, [tabindex], input[type='range']")
    );
    if (focusables.length === 0) return;
    var current = active && focusables.indexOf(active) !== -1 ? active : focusables[0];
    var next = findNearest(current, e.key, focusables);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  });

  function findNearest(current, direction, candidates) {
    var rect = current.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var best = null;
    var bestScore = Infinity;

    candidates.forEach(function (el) {
      if (el === current) return;
      var r = el.getBoundingClientRect();
      var ex = r.left + r.width / 2;
      var ey = r.top + r.height / 2;
      var dx = ex - cx;
      var dy = ey - cy;

      var valid = false;
      if (direction === "ArrowRight") valid = dx > 4;
      if (direction === "ArrowLeft") valid = dx < -4;
      if (direction === "ArrowDown") valid = dy > 4;
      if (direction === "ArrowUp") valid = dy < -4;
      if (!valid) return;

      var primary = direction === "ArrowLeft" || direction === "ArrowRight" ? Math.abs(dx) : Math.abs(dy);
      var secondary = direction === "ArrowLeft" || direction === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
      var score = primary + secondary * 2;

      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    });

    return best;
  }

  loadVideos();
})();
