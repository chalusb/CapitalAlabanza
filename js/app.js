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
  var video = document.getElementById("video-player");
  var playerStatus = document.getElementById("player-status");
  var replayBtn = document.getElementById("replay-btn");

  var allVideos = [];
  var selectedOrder = []; // array of video ids, in the order clicked
  var playQueue = [];
  var playIndex = 0;

  function showView(name) {
    Object.keys(views).forEach(function (key) {
      views[key].classList.toggle("active", key === name);
    });
  }

  function loadVideos() {
    fetch("videos.json", { cache: "no-store" })
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
      selectedOrder.push(id);
    } else {
      selectedOrder.splice(idx, 1);
    }
    refreshBadges();
    updatePlayButton();
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
    playBtn.disabled = selectedOrder.length === 0;
    playBtn.textContent =
      selectedOrder.length === 0
        ? "▶ Reproducir"
        : "▶ Reproducir (" + selectedOrder.length + ")";
  }

  clearBtn.addEventListener("click", function () {
    selectedOrder = [];
    refreshBadges();
    updatePlayButton();
  });

  playBtn.addEventListener("click", function () {
    if (selectedOrder.length === 0) return;
    playQueue = selectedOrder
      .map(function (id) {
        return allVideos.find(function (v) {
          return v.id === id;
        });
      })
      .filter(Boolean);
    playIndex = 0;
    showView("player");
    startPlayback();
  });

  function startPlayback() {
    playCurrent();
    requestFullscreenSafe(views.player);
  }

  function playCurrent() {
    if (playIndex >= playQueue.length) {
      finishPlayback();
      return;
    }
    var item = playQueue[playIndex];
    playerStatus.textContent =
      "Reproduciendo " + (playIndex + 1) + " de " + playQueue.length + ": " + item.titulo;
    video.src = item.url;
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

  function finishPlayback() {
    exitFullscreenSafe();
    showView("end");
    replayBtn.focus();
  }

  function stopPlaybackToSelection() {
    video.pause();
    video.removeAttribute("src");
    video.load();
    exitFullscreenSafe();
    showView("selection");
  }

  replayBtn.addEventListener("click", function () {
    selectedOrder = [];
    refreshBadges();
    updatePlayButton();
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

  // ---------- Navegacion espacial simple para control remoto (flechas) ----------
  document.addEventListener("keydown", function (e) {
    var dirs = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (dirs.indexOf(e.key) === -1) return;
    var active = document.activeElement;
    var container = active && active.closest ? active.closest(".view.active") : null;
    if (!container) return;
    var focusables = Array.prototype.slice.call(
      container.querySelectorAll("button, [tabindex]")
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
