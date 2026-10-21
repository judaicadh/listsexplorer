(function () {
  "use strict";
  var BASE = window.SITE_BASE || "/";
  var PAGE_SIZE = 50;
  var form = document.getElementById("search-form");
  var tbody = document.getElementById("results");
  var status = document.getElementById("status");
  var pager = document.getElementById("pager");
  var curNote = document.getElementById("cur-note");
  var rows = [], filtered = [], page = 1, meta = {};

  function href(u) { return u ? BASE.replace(/\/$/, "") + u : ""; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  function link(text, url) { return url ? '<a href="' + esc(href(url)) + '">' + esc(text) + "</a>" : esc(text || "—"); }

  function fillSelect(id, values, labels) {
    var sel = document.getElementById(id);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = labels ? labels[v] || v : v;
      sel.appendChild(o);
    });
  }
  function uniq(key) {
    var seen = {};
    rows.forEach(function (r) { if (r[key]) seen[r[key]] = 1; });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
  }

  function readParams() {
    var p = new URLSearchParams(location.search);
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === "checkbox") el.checked = p.get(el.name) === el.value;
      else if (p.has(el.name)) el.value = p.get(el.name);
    });
    page = Math.max(1, Number(p.get("page")) || 1);
  }
  function writeParams() {
    var p = new URLSearchParams();
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === "checkbox") { if (el.checked) p.set(el.name, el.value); }
      else if (el.value && !(el.name === "sort" && el.value === "list")) p.set(el.name, el.value);
    });
    if (page > 1) p.set("page", page);
    var qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  function apply() {
    var f = form.elements;
    var q = norm(f.q.value).trim().split(/\s+/).filter(Boolean);
    var type = f.type.value, place = f.place.value, list = f.list.value, agent = f.agent.value, cur = f.cur.value;
    var from = Number(f.from.value) || null, to = Number(f.to.value) || null;
    var linked = f.linked.checked;
    filtered = rows.filter(function (r) {
      if (type && r.t !== type) return false;
      if (place && r.p !== place) return false;
      if (list && r.l !== list) return false;
      if (agent && r.g !== agent) return false;
      if (cur && r.c !== cur) return false;
      if (from && (r.y == null || r.y < from)) return false;
      if (to && (r.y == null || r.y > to)) return false;
      if (linked && !r.e) return false;
      for (var i = 0; i < q.length; i++) if (r._text.indexOf(q[i]) < 0) return false;
      return true;
    });
    var sort = f.sort.value;
    filtered.sort(function (a, b) {
      if (sort === "amount") return (a.c || "~").localeCompare(b.c || "~") || (b.v || 0) - (a.v || 0);
      if (sort === "name") return (a.e || a.n).localeCompare(b.e || b.n);
      if (sort === "place") return (a.p || "~").localeCompare(b.p || "~");
      if (sort === "year") return (a.y || 0) - (b.y || 0) || a._i - b._i;
      return a._i - b._i;
    });
    var curs = {};
    filtered.forEach(function (r) { if (r.c) curs[r.c] = 1; });
    curNote.hidden = Object.keys(curs).length < 2;
    render();
  }

  function render() {
    var pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > pages) page = pages;
    var start = (page - 1) * PAGE_SIZE;
    var slice = filtered.slice(start, start + PAGE_SIZE);
    status.innerHTML = "<b>" + filtered.length.toLocaleString() + "</b> of " + rows.length.toLocaleString() + " entries" +
      (filtered.length > PAGE_SIZE ? " · showing " + (start + 1) + "–" + (start + slice.length) : "");
    tbody.innerHTML = slice.length ? slice.map(function (r) {
      var cert = r.x === "uncertain" ? ' <span class="cert" title="Reading uncertain">?</span>' : r.x === "probable" ? ' <span class="cert cert-prob" title="Reading probable">~</span>' : "";
      return "<tr><td>" + esc(r.n) + cert + "</td><td>" + link(r.e, r.eu) + "</td><td>" + link(r.l, r.lu) +
        '</td><td class="num">' + esc(r.y || "") + "</td><td>" + link(r.p, r.pu) + "</td><td>" + link(r.g, r.gu) +
        '</td><td class="num">' + esc(r.a) + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="empty">No entries match. Try another spelling or clear some filters.</td></tr>';
    var html = "";
    if (pages > 1) {
      if (page > 1) html += '<button type="button" data-page="' + (page - 1) + '">← Previous</button>';
      var lo = Math.max(1, page - 3), hi = Math.min(pages, page + 3);
      for (var i = lo; i <= hi; i++) html += '<button type="button" data-page="' + i + '"' + (i === page ? ' aria-current="page"' : "") + ">" + i + "</button>";
      if (page < pages) html += '<button type="button" data-page="' + (page + 1) + '">Next →</button>';
    }
    pager.innerHTML = html;
    writeParams();
  }

  function downloadCsv() {
    var cols = [["id", "id"], ["name_as_printed", "n"], ["identified_as", "e"], ["list", "l"], ["year", "y"], ["place", "p"], ["agent", "g"], ["agent_as_printed", "gp"], ["section", "s"], ["role", "r"], ["amount", "a"], ["currency", "c"], ["quantity", "q"], ["certainty", "x"]];
    var q = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [cols.map(function (c) { return c[0]; }).join(",")].concat(filtered.map(function (r) {
      return cols.map(function (c) { return q(r[c[1]]); }).join(",");
    }));
    var blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "entries.csv";
    document.body.appendChild(a); a.click(); a.remove();
  }

  fetch(href("/search-index.json"))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      meta = data;
      rows = data.rows.map(function (r, i) {
        r._i = i;
        r._text = norm([r.n, r.e, r.l, r.p, r.g, r.s, r.k, r.y].join(" "));
        return r;
      });
      fillSelect("f-type", Object.keys(data.types).filter(function (t) { return rows.some(function (r) { return r.t === t; }); }), data.types);
      fillSelect("f-place", uniq("p"));
      fillSelect("f-list", uniq("l"));
      fillSelect("f-agent", uniq("g"));
      fillSelect("f-cur", uniq("c"), data.currencies);
      readParams();
      apply();
    })
    .catch(function () { status.textContent = "The search index could not be loaded."; });

  form.addEventListener("input", function () { page = 1; apply(); });
  form.addEventListener("change", function () { page = 1; apply(); });
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  form.addEventListener("reset", function () { setTimeout(function () { page = 1; apply(); }, 0); });
  pager.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-page]");
    if (!b) return;
    page = Number(b.getAttribute("data-page"));
    render();
    document.getElementById("main").scrollIntoView();
  });
  document.getElementById("download").addEventListener("click", downloadCsv);
})();
