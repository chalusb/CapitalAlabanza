(function () {
  "use strict";
  var button = document.getElementById("back-to-songs");
  var grid = document.getElementById("grid");
  var view = document.getElementById("view-selection");
  var previous = null;
  function update() {
    var visible = view.classList.contains("active") && grid.getBoundingClientRect().bottom < 0;
    if (!visible && document.activeElement === button) {
      (grid.querySelector("button") || document.getElementById("shuffle-btn")).focus({ preventScroll: true });
    }
    button.hidden = !visible;
  }
  button.addEventListener("click", function () {
    document.dispatchEvent(new CustomEvent("app:back-to-songs"));
    (grid.querySelector("button") || document.getElementById("shuffle-btn")).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  // Right reaches the shortcut from a verse; Left returns to that verse.
  document.addEventListener("keydown", function (event) {
    if (button.hidden) return;
    var focused = document.activeElement;
    if (event.key === "ArrowRight" && focused.matches(".bible-verse")) {
      previous = focused;
      button.focus({ preventScroll: true });
    } else if (event.key === "ArrowLeft" && focused === button && previous && previous.isConnected) {
      previous.focus({ preventScroll: true });
    } else return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  document.addEventListener("app:viewchange", function () { requestAnimationFrame(update); });
  update();
})();
