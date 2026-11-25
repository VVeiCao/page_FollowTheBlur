// Interactive point-cloud view of a case's 4D control (data: cloud.py -> /page_FollowTheBlur/web_assets/clouds/<name>.js; Three.js r128 + OrbitControls, both local).
// FTBViewer.mount(frameEl, name, clockVideo) -> handle with .dispose(). The rigid proxies move by their 81 transforms, in step with clockVideo if given.
(function () {
  var COL = [0x1F5F5B, 0xC4623A], CAMC = 0x1B2230, GOLD = 0xE0A000, loading = {};
  function b64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function deq(s, lo, hi) { var q = new Uint16Array(b64(s).buffer), o = new Float32Array(q.length);
    for (var i = 0; i < q.length; i++) { var k = i % 3; o[i] = lo[k] + q[i] / 65535 * (hi[k] - lo[k]); } return o; }
  function load(name, base) { if (!loading[name]) loading[name] = new Promise(function (ok, bad) {
      if (window.FTB_CLOUDS && window.FTB_CLOUDS[name]) return ok(window.FTB_CLOUDS[name]);
      var s = document.createElement("script"); s.src = base + name + ".js"; s.onload = function () { ok(window.FTB_CLOUDS[name]); }; s.onerror = bad; document.head.appendChild(s); });
    return loading[name]; }
  function mat(a, k) { var m = new THREE.Matrix4(); m.set.apply(m, a.slice(16 * k, 16 * k + 16)); return m; }
  function mount(frame, name, clock) {
    var dead = false, raf = 0, renderer, controls, ro, h = { dispose: function () { dead = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (controls) controls.dispose();
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); } frame.classList.remove("is-live"); } };
    load(name, frame.dataset.base || "/page_FollowTheBlur/web_assets/clouds/").then(function (D) { if (dead) return;
      var W = frame.clientWidth, H = frame.clientHeight, N = D.cams.length / 16;
      renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W, H); renderer.setClearColor(0xffffff, 1);
      frame.appendChild(renderer.domElement); frame.classList.add("is-live");
      var scene = new THREE.Scene(), c0 = mat(D.cams, 0), o0 = new THREE.Vector3().setFromMatrixPosition(c0);
      var ax = function (m, i) { return new THREE.Vector3(m.elements[4 * i], m.elements[4 * i + 1], m.elements[4 * i + 2]).normalize(); };
      var fwd = ax(c0, 2), up = ax(c0, 1).negate(), right = ax(c0, 0), fx = D.K[0];
      var paths = D.objs.map(function (o) { var P = []; for (var i = 0; i < o.path.length; i += 3) P.push(new THREE.Vector3(o.path[i], o.path[i + 1], o.path[i + 2])); return P; });
      var pts = [].concat.apply([], paths), box = new THREE.Box3().setFromPoints(pts), tgt = box.getCenter(new THREE.Vector3()), dist = tgt.clone().sub(o0).dot(fwd);
      var span = Math.max.apply(null, [box.getSize(new THREE.Vector3()).length()].concat(D.objs.map(function (o) { return o.size; })));
      var Rf = Math.max(span * 2.6, dist * 1.5), px = dist / fx, pr = renderer.getPixelRatio();
      var pmat = function (size, bg) { return new THREE.ShaderMaterial({ transparent: true, depthWrite: !bg || true,
        uniforms: { size: { value: size }, tgt: { value: tgt }, R: { value: bg ? Rf : 1e9 }, sc: { value: H * pr }, o0: { value: o0 }, fw: { value: fwd }, dz: { value: bg ? dist : 1e9 } },
        vertexShader: "attribute vec3 color; uniform float size, R, sc, dz; uniform vec3 tgt, o0, fw; varying vec3 vc; varying float va;" +
          "float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }" +
          "void main(){ vec4 w = modelMatrix * vec4(position,1.); vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv; float d = distance(w.xyz, tgt) / R;" +
          "va = 1. - smoothstep(.55, 1., d + .35 * h(position) * smoothstep(.3, 1., d)); vc = color; gl_PointSize = max(1.5, size * max(1., dot(w.xyz - o0, fw) / dz) * sc / -mv.z); }",
        fragmentShader: "varying vec3 vc; varying float va; void main(){ vec2 c = gl_PointCoord - .5; if (dot(c,c) > .25 || va < .02) discard; gl_FragColor = vec4(vc, va); }" }); };
      var cloud = function (pos, col, size, bg) { var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("color", new THREE.BufferAttribute(col, 3, true)); var p = new THREE.Points(g, pmat(size, bg)); p.frustumCulled = false; scene.add(p); return p; };
      cloud(deq(D.bg, D.lo, D.hi), b64(D.bgc), px * 7.5, true);
      var rw = Math.max(span, dist * .35) * .0085;
      var basic = function (color) { return new THREE.MeshBasicMaterial({ color: color, depthTest: false, transparent: true, depthWrite: false }); };
      var add = function (geo, color, order, parent) { var m = new THREE.Mesh(geo, basic(color)); m.renderOrder = order; (parent || scene).add(m); return m; };
      var tube = function (curve, r, color, order, parent) { return add(new THREE.TubeGeometry(curve, 120, r, 10, false), color, order, parent); };
      var smooth = function (P, k) { return P.map(function (_, i) { var a = Math.max(0, i - k), b = Math.min(P.length - 1, i + k), s = new THREE.Vector3(); for (var j = a; j <= b; j++) s.add(P[j]); return s.multiplyScalar(1 / (b - a + 1)); }); };
      var thin = function (P) { return P.filter(function (_, i) { return i % 4 === 0 || i === P.length - 1; }); };
      var objs = D.objs.map(function (o, k) { var P = paths[k], len = 0; for (var i = 1; i < P.length; i++) len += P[i].distanceTo(P[i - 1]);
        if (len >= rw * 9) { var S = smooth(P, 6); S[0] = P[0]; S[S.length - 1] = P[P.length - 1]; var cv = new THREE.CatmullRomCurve3(thin(S));
          var head = rw * 3.2 * 2.6, tE = Math.max(.05, 1 - head / len), body = new THREE.CatmullRomCurve3(cv.getPoints(200).slice(0, Math.round(200 * tE) + 1)), od = 10 + 10 * k;
          tube(body, rw * 1.9, 0xffffff, od); tube(body, rw, COL[k], od + 2);
          var tip = cv.getPoint(1), base = cv.getPoint(tE), dir = tip.clone().sub(base);
          [[rw * 4.1, 0xffffff, od + 1, .5], [rw * 3.2, COL[k], od + 3, .52]].forEach(function (a) { var m = add(new THREE.ConeGeometry(a[0], a[0] * 2.6, 20), a[1], a[2]);
            m.position.copy(base).addScaledVector(dir, a[3]); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); });
          [[rw * 2.9, 0xffffff, od + 1], [rw * 2.1, COL[k], od + 3]].forEach(function (a) { add(new THREE.SphereGeometry(a[0], 20, 14), a[1], a[2]).position.copy(P[0]); }); }
        var p = cloud(deq(o.p, o.lo, o.hi), b64(o.c), px * 5.0, false); p.matrixAutoUpdate = false; return p; });
      // camera: a wireframe that follows the camera of the current frame; its path in gold if it moves
      var CP = []; for (var k = 0; k < N; k++) CP.push(new THREE.Vector3().setFromMatrixPosition(mat(D.cams, k)));
      var cmove = CP[N - 1].distanceTo(CP[0]) > dist * .05, fs = dist * .2 * Math.max(1, fx / D.wh[0] / 1.4);
      var rig = new THREE.Group(); rig.matrixAutoUpdate = false; scene.add(rig);
      var z = new THREE.Vector3(), cs = [[0, 0], [D.wh[0], 0], [D.wh[0], D.wh[1]], [0, D.wh[1]]].map(function (p) { return new THREE.Vector3((p[0] - D.K[2]) / fx * fs, (p[1] - D.K[5]) / D.K[4] * fs, fs); });
      cs.forEach(function (p, i) { [[z, p], [p, cs[(i + 1) % 4]]].forEach(function (s) { tube(new THREE.LineCurve3(s[0], s[1]), rw * .42, 0xffffff, 40, rig); tube(new THREE.LineCurve3(s[0], s[1]), rw * .22, cmove ? 0x8A6200 : CAMC, 41, rig); }); });
      if (cmove) { var cc = new THREE.CatmullRomCurve3(thin(CP)); tube(cc, rw * 1.5, 0xffffff, 42); tube(cc, rw * .85, GOLD, 43); }
      // view: behind and above camera 0; zoom set by the objects and their paths
      var cam = new THREE.PerspectiveCamera(32, W / H, dist * .02, dist * 60); cam.up.copy(up);
      var fit = pts.slice(); D.objs.forEach(function (o, k) { [0, N - 1].forEach(function (i) { var c = paths[k][i]; [[up, .55], [up, -.5], [right, .5], [right, -.5]].forEach(function (a) { fit.push(c.clone().addScaledVector(a[0], o.size * a[1])); }); }); });
      var all = fit.concat(CP, [o0.clone().addScaledVector(fwd, fs)]);
      var dir = fwd.clone().multiplyScalar(-1).addScaledVector(up, cmove ? .75 : .34).addScaledVector(right, cmove ? 0 : .22).normalize();
      var fitD = function (F) { var look = new THREE.Box3().setFromPoints(F).getCenter(new THREE.Vector3()), d = dist * .3;
        for (var it = 0; it < 80; it++) { cam.position.copy(look).addScaledVector(dir, d); cam.lookAt(look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
          if (F.every(function (p) { var s = p.clone().project(cam); return Math.abs(s.x) < .9 && Math.abs(s.y) < .88; })) break; d *= 1.05; } return [look, d]; };
      var compact = frame.classList.contains("is-compact") || frame.dataset.zoom === "objects";   // small tile: zoom on the objects, the camera only if it moves
      var a = fitD(fit), b = fitD(all), useAll = (!compact && b[1] <= a[1] * 1.6) || cmove, look = useAll ? b[0] : a[0], d0 = useAll ? b[1] : a[1] * (compact ? 1.0 : 1.15);
      var home = function () { cam.position.copy(look).addScaledVector(dir, d0); cam.up.copy(up); controls.target.copy(look); controls.update(); };
      controls = new THREE.OrbitControls(cam, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .12; controls.enableZoom = false; controls.minDistance = dist * .08; controls.maxDistance = dist * 20;
      // the page keeps scrolling over the view: zoom only with Ctrl / Cmd + wheel
      renderer.domElement.addEventListener("wheel", function (e) { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); var v = cam.position.clone().sub(controls.target); v.multiplyScalar(Math.exp(e.deltaY * .0015)); cam.position.copy(controls.target).add(v); }, { passive: false });
      var swing = true; controls.addEventListener("start", function () { swing = false; frame.classList.add("is-orbited"); });
      home(); var rb = frame.querySelector(".pv-reset"); if (rb) rb.onclick = function () { home(); swing = true; t0 = performance.now(); };
      ro = new ResizeObserver(function () { var w = frame.clientWidth, hh = frame.clientHeight; if (!w || !hh) return; renderer.setSize(w, hh); cam.aspect = w / hh; cam.updateProjectionMatrix(); }); ro.observe(frame);
      var t0 = performance.now(), still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      (function tick() { if (dead) return; raf = requestAnimationFrame(tick);
        var t = clock && clock.readyState > 1 ? clock.currentTime : (performance.now() - t0) / 1000, f = Math.min(N - 1, Math.floor(t * 16) % N);
        objs.forEach(function (p, k) { p.matrix.copy(mat(D.objs[k].T, f)); p.matrixWorldNeedsUpdate = true; }); rig.matrix.copy(mat(D.cams, f)); rig.matrixWorldNeedsUpdate = true;
        // until the viewer is dragged, the view swings slowly by +-22 degrees about the vertical axis (user, 11-19: "3D 需要自己缓慢转动")
        if (swing && !still) { var an = Math.sin((performance.now() - t0) / 1000 * 2 * Math.PI / 12) * 22 * Math.PI / 180; cam.position.copy(look).add(dir.clone().multiplyScalar(d0).applyAxisAngle(up, an)); cam.up.copy(up); controls.target.copy(look); }
        controls.update(); renderer.render(scene, cam); })();
    }).catch(function (e) { console.error("FTBViewer", name, e && (e.stack || e.message || e)); frame.classList.add("is-failed"); });
    return h;
  }
  window.FTBViewer = { mount: mount };
})();
