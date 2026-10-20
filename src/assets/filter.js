// Live filter for directory pages (people, organizations, places, agents, lists).
(function () {
  var input = document.querySelector("[data-filter-input]");
  if (!input) return;
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-filter-item]"));
  var groups = Array.prototype.slice.call(document.querySelectorAll("[data-filter-group]"));
  var count = document.querySelector("[data-filter-count]");
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  items.forEach(function (el) { el._t = norm(el.getAttribute("data-filter-item") + " " + el.textContent); });
  function run() {
    var q = norm(input.value).trim().split(/\s+/).filter(Boolean);
    var shown = 0;
    items.forEach(function (el) {
      var ok = q.every(function (w) { return el._t.indexOf(w) >= 0; });
      el.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach(function (g) { g.hidden = !g.querySelector("[data-filter-item]:not([hidden])"); });
    if (count) count.textContent = shown + " shown";
  }
  input.addEventListener("input", run);
})();
