// Supplementary page: carousels (one case per slide), lazy videos that play in step, one live 3D view per carousel.
(function () {
  function loadVideo(v) { if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.load(); } }
  // videos of one group start together and are kept in step with the first one that has data-lead (or the first video)
  function playGroup(g) { var vs = [].slice.call(g.querySelectorAll("video")); vs.forEach(loadVideo);
    var lead = g.querySelector("video[data-lead]") || vs[0]; if (!lead) return;
    var go = function () { vs.forEach(function (v) { try { v.currentTime = lead.currentTime; } catch (e) {} v.play().catch(function () {}); }); };
    var wait = vs.filter(function (v) { return v.readyState < 3; }), n = wait.length; if (!n) go();
    wait.forEach(function (v) { v.addEventListener("canplay", function f() { v.removeEventListener("canplay", f); if (--n === 0) go(); }); });
    setTimeout(go, 4000);
    if (!lead._sync) { lead._sync = true; lead.addEventListener("timeupdate", function () { vs.forEach(function (v) { if (v !== lead && !v.paused && Math.abs(v.currentTime - lead.currentTime) > .18) v.currentTime = lead.currentTime; }); }); } }
  function pauseGroup(g) { [].forEach.call(g.querySelectorAll("video"), function (v) { v.pause(); }); }
  function mount3d(g) { var f = g.querySelector(".pv"); if (!f || f._h || !window.FTBViewer) return; f._h = FTBViewer.mount(f, f.dataset.cloud, g.querySelector("video[data-lead]")); }
  function drop3d(g) { var f = g.querySelector(".pv"); if (f && f._h) { f._h.dispose(); f._h = null; } }
  var seen = new WeakMap();
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { var g = e.target; seen.set(g, e.isIntersecting);
    if (e.isIntersecting && !g.hidden && g.dataset.active !== "0") { playGroup(g); mount3d(g); } else { pauseGroup(g); drop3d(g); } }); }, { rootMargin: "200px 0px" });
  [].forEach.call(document.querySelectorAll("[data-video-sync]"), function (g) { io.observe(g); });
  // method tabs: one example at a time
  [].forEach.call(document.querySelectorAll(".method-tab"), function (b) { b.onclick = function () {
    [].forEach.call(document.querySelectorAll(".method-tab"), function (x) { x.classList.toggle("is-active", x === b); });
    [].forEach.call(document.querySelectorAll(".method-steps"), function (g) { g.hidden = g.dataset.tab !== b.dataset.tab; if (g.hidden) pauseGroup(g); else playGroup(g); }); }; });
  [].forEach.call(document.querySelectorAll(".qualitative-carousel"), function (c) {
    var track = c.querySelector(".qualitative-carousel-track"), slides = [].slice.call(track.children), wrap = c.parentNode, i = 0;
    var items = [].slice.call(wrap.querySelectorAll(".qualitative-progress-item")), prev = c.querySelector(".is-previous"), next = c.querySelector(".is-next");
    var cur = wrap.querySelector(".qualitative-progress-current-title"), cnt = wrap.querySelector(".qualitative-progress-count strong"), bar = wrap.querySelector(".qualitative-progress-bar > span");
    function show(k, scroll) { i = Math.max(0, Math.min(slides.length - 1, k)); track.style.transform = "translateX(" + (-100 * i) + "%)";
      slides.forEach(function (s, j) { s.dataset.active = j === i ? "1" : "0"; s.setAttribute("aria-hidden", j === i ? "false" : "true");
        if (j === i) { if (seen.get(s) !== false) { playGroup(s); mount3d(s); } } else { pauseGroup(s); drop3d(s); } });
      items.forEach(function (b, j) { b.classList.toggle("is-active", j === i); b.classList.toggle("is-complete", j < i); });
      if (items[i] && scroll) { var L = items[i].parentNode; L.scrollTo({ left: items[i].offsetLeft - L.clientWidth / 2 + items[i].clientWidth / 2, behavior: "smooth" }); }
      prev.disabled = i === 0; next.disabled = i === slides.length - 1;
      if (cur) cur.textContent = slides[i].dataset.title || ""; if (cnt) cnt.textContent = String(i + 1).padStart(2, "0"); if (bar) bar.style.width = (100 * (i + 1) / slides.length) + "%";
      track.style.height = ""; }
    prev.onclick = function () { show(i - 1, true); }; next.onclick = function () { show(i + 1, true); };
    items.forEach(function (b, j) { b.onclick = function () { show(j, true); }; });
    c.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") show(i - 1, true); if (e.key === "ArrowRight") show(i + 1, true); });
    show(0, false);
  });
})();
