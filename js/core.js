/* Core: state, proyeksi, view, history, persistence */
(function (MC) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  MC.clamp = clamp;
  MC.W = 1000; MC.H = 700; MC._id = 0;
  MC.uid = () => 'o' + (++MC._id);
  MC.tool = 'select';
  MC.sel = null; // {kind:'obj',id} | {kind:'base',id,name,level}
  MC.listeners = {};
  MC.on = (ev, fn) => ((MC.listeners[ev] = MC.listeners[ev] || []).push(fn));
  MC.emit = (ev, a) => (MC.listeners[ev] || []).forEach((f) => f(a));

  /* ---------- dokumen ---------- */
  MC.defaultDoc = function () {
    return {
      app: 'map-creator', v: 1, theme: 'classic',
      scope: { type: 'world', id: null }, isolate: false, admin1: true, autoProj: true, projection: 'naturalEarth',
      style: Object.assign({ countryLabels: true, adminLabels: true, cities: true, lakes: true, font: 'Georgia', labelSize: 1, pageBgCustom: false }, MC.THEMES.classic.style),
      layout: {
        aspect: 0,
        title: { show: true, text: 'Peta Baru Saya', sub: 'Dibuat dengan Map Creator', size: 30, color: '#1f2933', font: 'Georgia', align: 'left', pos: 'top', bg: true, bgColor: '#ffffff', bgOpacity: 0.82 },
        legend: { show: true, title: 'Legenda', pos: 'bl' },
        scalebar: { show: true, pos: 'br' },
        compass: { show: true, pos: 'tr' },
        frame: { show: true, width: 5, color: '#1f2933', inset: 8, style: 'double' }
      },
      real: Object.assign({}, MC.REAL_DEFAULT),
      objects: [], overrides: {}, view: { lon: 10, lat: 15, k: 150 }
    };
  };
  MC.state = MC.defaultDoc();

  function mergeDefaults(def, d) {
    if (Array.isArray(def) || typeof def !== 'object' || def === null) return d === undefined ? def : d;
    const out = {};
    for (const k in def) out[k] = d && d[k] !== undefined ? (typeof def[k] === 'object' && def[k] !== null && !Array.isArray(def[k]) ? mergeDefaults(def[k], d[k]) : d[k]) : def[k];
    for (const k in d || {}) if (!(k in out)) out[k] = d[k];
    return out;
  }
  MC.mergeDefaults = mergeDefaults;

  MC.touch = (o) => { o._v = (o._v || 0) + 1; };
  MC.getObj = (id) => MC.state.objects.find((o) => o.id === id);
  MC.selObj = () => (MC.sel && MC.sel.kind === 'obj' ? MC.getObj(MC.sel.id) : null);

  /* ---------- invalidate / render scheduling ---------- */
  MC.dirty = {};
  MC.invalidate = function (what) {
    const D = MC.dirty;
    const map = {
      view: ['base', 'user', 'ui', 'scale', 'cities', 'real'], objects: ['user', 'ui', 'deco'], ui: ['ui'], layout: ['deco', 'scale'],
      style: ['base', 'deco', 'user'], all: ['base', 'user', 'ui', 'scale', 'deco', 'cities', 'real']
    };
    (map[what] || [what]).forEach((k) => (D[k] = true));
    if (!MC._raf) MC._raf = requestAnimationFrame(() => { MC._raf = 0; MC.render && MC.render(); });
  };

  /* ---------- proyeksi & view ---------- */
  MC.makeProj = function (view, key, W, H) {
    view = view || MC.state.view; key = key || MC.state.projection; W = W || MC.W; H = H || MC.H;
    const P = MC.PROJ[key], p = P.make();
    if (P.az) p.rotate([-view.lon, -view.lat]); else p.rotate([-view.lon, 0]).center([0, view.lat]);
    p.scale(view.k).translate([W / 2, H / 2]);
    if (P.clip) p.clipAngle(P.clip);
    p.clipExtent([[-30, -30], [W + 30, H + 30]]);
    return p;
  };
  MC.syncProj = function () {
    const v = MC.state.view, P = MC.PROJ[MC.state.projection];
    MC.proj = MC.makeProj();
    MC.center = [v.lon, v.lat];
    MC.clipRad = P.clip && P.clip <= 100 ? (P.clip * Math.PI) / 180 - 0.01 : null;
  };
  MC.px = function (pt) {
    if (MC.clipRad && d3.geoDistance(pt, MC.center) > MC.clipRad) return null;
    const r = MC.proj(pt);
    return r && isFinite(r[0]) && isFinite(r[1]) ? r : null;
  };
  MC.inv = function (xy) {
    const r = MC.proj.invert(xy);
    if (!r || !isFinite(r[0]) || !isFinite(r[1])) return null;
    if (MC.clipRad && d3.geoDistance(r, MC.center) > MC.clipRad + 0.02) return null;
    return r;
  };
  const normLon = (l) => ((((l + 180) % 360) + 360) % 360) - 180;
  MC.setView = function (v, opts) {
    const P = MC.PROJ[MC.state.projection];
    MC.state.view = { lon: normLon(v.lon), lat: clamp(v.lat, P.az ? -90 : -84, P.az ? 90 : 84), k: v.k };
    MC.syncProj();
    MC.invalidate('view');
    if (!opts || !opts.silent) MC.emit('view');
  };
  MC.kRange = () => [Math.min(MC.W, MC.H) / 14, 6e6];

  MC.zoomAt = function (f, cx, cy) {
    const v = MC.state.view, P = MC.PROJ[MC.state.projection];
    const [kmin, kmax] = MC.kRange();
    const nk = clamp(v.k * f, kmin, kmax);
    if (P.az) return MC.setView({ lon: v.lon, lat: v.lat, k: nk });
    const p0 = MC.proj.invert([cx, cy]);
    if (!p0 || !isFinite(p0[0])) return MC.setView({ lon: v.lon, lat: v.lat, k: nk });
    const tmp = MC.makeProj({ lon: v.lon, lat: v.lat, k: nk });
    const q = tmp(p0), dx = cx - q[0], dy = cy - q[1];
    const c = tmp.invert([MC.W / 2 - dx, MC.H / 2 - dy]);
    if (c && isFinite(c[0])) MC.setView({ lon: c[0], lat: c[1], k: nk });
  };
  MC.panFrom = function (view0, proj0, dx, dy) {
    const P = MC.PROJ[MC.state.projection];
    if (P.az) {
      const s = 180 / (Math.PI * view0.k);
      return MC.setView({ lon: view0.lon - dx * s, lat: clamp(view0.lat + dy * s, -90, 90), k: view0.k });
    }
    const c = proj0.invert([MC.W / 2 - dx, MC.H / 2 - dy]);
    if (c && isFinite(c[0])) MC.setView({ lon: c[0], lat: c[1], k: view0.k });
  };

  /* fly animation */
  MC.flyTo = function (target, dur) {
    return new Promise((resolve) => {
      MC.cancelFly && MC.cancelFly();
      const v0 = Object.assign({}, MC.state.view), v1 = target;
      const dl = ((v1.lon - v0.lon + 540) % 360) - 180, dlat = v1.lat - v0.lat;
      const lk0 = Math.log(v0.k), lk1 = Math.log(v1.k);
      const dist = Math.hypot(dl, dlat);
      dur = dur || clamp(700 + dist * 14, 800, 2400);
      const bump = Math.min(1.4, dist / 70);
      const t0 = performance.now();
      let stop = false;
      MC.cancelFly = () => { stop = true; MC.cancelFly = null; resolve(false); };
      (function step(now) {
        if (stop) return;
        const t = clamp((now - t0) / dur, 0, 1), e = d3.easeCubicInOut(t);
        MC.setView({ lon: v0.lon + dl * e, lat: v0.lat + dlat * e, k: Math.exp(lk0 + (lk1 - lk0) * e - bump * Math.sin(Math.PI * t)) }, { silent: true });
        if (t < 1) requestAnimationFrame(step); else { MC.cancelFly = null; MC.emit('view'); resolve(true); }
      })(t0);
    });
  };
  MC.fadeTo = function (fn) {
    const el = MC.svg;
    el.style.transition = 'opacity .22s'; el.style.opacity = 0;
    setTimeout(() => { fn(); MC.invalidate('all'); el.style.opacity = 1; }, 230);
  };

  /* ---------- data ---------- */
  function polysOf(g) { return g.type === 'Polygon' ? [g.coordinates] : g.coordinates; }
  MC.prep = function (f) {
    if (f._polys) return f;
    f._polys = polysOf(f.geometry);
    f._areas = f._polys.map((c) => d3.geoArea({ type: 'Polygon', coordinates: c }));
    let mi = 0; f._areas.forEach((a, i) => { if (a > f._areas[mi]) mi = i; });
    f._mi = mi; f._area = f._areas[mi];
    f._c = d3.geoCentroid({ type: 'Polygon', coordinates: f._polys[mi] });
    return f;
  };
  function greedyColors(neigh) {
    const n = neigh.length, order = [...Array(n).keys()].sort((a, b) => neigh[b].length - neigh[a].length), col = new Array(n).fill(-1);
    for (const i of order) { const used = new Set(neigh[i].map((j) => col[j])); let c = 0; while (used.has(c)) c++; col[i] = c; }
    return col;
  }
  MC.initData = function () {
    const t = window.MC_COUNTRIES, fc = topojson.feature(t, t.objects.countries);
    MC.countries = fc.features; MC.byA = new Map();
    const col = greedyColors(topojson.neighbors(t.objects.countries.geometries));
    MC.countries.forEach((f, i) => { f.key = 'c:' + f.properties.a; f.name = f.properties.n; f.color = col[i]; MC.byA.set(f.properties.a, f); });
    MC.lakes = topojson.feature(window.MC_LAKES, window.MC_LAKES.objects.lakes);
    MC.cities = window.MC_CITIES.map((r) => ({ n: r[0], ll: [r[1], r[2]], a: r[3], pop: r[4], cap: r[5], c: (MC.byA.get(r[3]) || { properties: {} }).properties.c })).sort((a, b) => b.cap * 2e7 + b.pop - (a.cap * 2e7 + a.pop));
    MC.countryList = MC.countries.map((f) => ({ a: f.properties.a, n: f.properties.n, c: f.properties.c })).sort((a, b) => a.n.localeCompare(b.n));
  };
  MC.loadAdmin1 = function () {
    if (MC._a1p) return MC._a1p;
    MC.toast('Memuat data provinsi…', 4000);
    MC._a1p = new Promise((res) => {
      const s = document.createElement('script'); s.src = 'data/admin1.js';
      s.onload = () => {
        const t = window.MC_ADMIN1, fc = topojson.feature(t, t.objects.admin1), geoms = t.objects.admin1.geometries;
        MC.admin1 = fc.features; MC.a1By = new Map(); MC.a1Geoms = new Map();
        fc.features.forEach((f, i) => {
          f.key = 'p:' + f.properties.a + ':' + i; f.name = f.properties.n;
          const a = f.properties.a;
          if (!MC.a1By.has(a)) { MC.a1By.set(a, []); MC.a1Geoms.set(a, []); }
          MC.a1By.get(a).push(f); MC.a1Geoms.get(a).push(geoms[i]);
        });
        MC.a1Colors = new Map();
        MC.a1By.forEach((list, a) => {
          if (list.length < 2) { list.forEach((f) => (f.color = 0)); return; }
          const col = greedyColors(topojson.neighbors(MC.a1Geoms.get(a)));
          list.forEach((f, i) => (f.color = col[i]));
        });
        window.MC_ADMIN1 = null; MC.invalidate('base'); MC.emit('admin1'); res();
      };
      s.onerror = () => { MC._a1p = null; MC.toast('Gagal memuat data provinsi'); res(); };
      document.head.appendChild(s);
    });
    return MC._a1p;
  };

  /* ---------- scope: fit ---------- */
  function boxPoints(l0, b0, l1, b1) {
    const pts = [];
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) if (i === 0 || j === 0 || i === 8 || j === 8) pts.push([l0 + ((l1 - l0) * i) / 8, b0 + ((b1 - b0) * j) / 8]);
    return pts;
  }
  function regionPoints(f) {
    MC.prep(f);
    const big = f._area > 0.05, R = big ? 1.7 : 0.95, mc = f._c, pts = [];
    f._polys.forEach((poly, i) => {
      if (i !== f._mi) {
        if (f._areas[i] < 3e-5) return;
        if (d3.geoDistance(mc, d3.geoCentroid({ type: 'Polygon', coordinates: poly })) > R) return;
      }
      const ring = poly[0], step = Math.max(1, Math.floor(ring.length / 150));
      for (let j = 0; j < ring.length; j += step) pts.push(ring[j]);
    });
    return pts;
  }
  MC.autoProj = function (scope) {
    if (scope.type === 'world') return 'naturalEarth';
    if (scope.type === 'blank') return 'equirect';
    if (scope.type === 'continent') return scope.id === 'Antarctica' ? 'stereographic' : 'equalEarth';
    const f = MC.byA.get(scope.id);
    if (!f) return 'mercator';
    MC.prep(f);
    return Math.abs(f._c[1]) > 52 ? 'equalEarth' : 'mercator';
  };
  MC.fitPoints = function (points, key, pad, padY, centerOverride) {
    const P = MC.PROJ[key], p = P.make(), c = centerOverride || d3.geoCentroid({ type: 'MultiPoint', coordinates: points });
    if (P.az) p.rotate([-c[0], -c[1]]); else p.rotate([-c[0], 0]);
    padY = padY == null ? pad : padY;
    p.fitExtent([[pad, padY], [MC.W - pad, MC.H - padY]], { type: 'MultiPoint', coordinates: points });
    const ctr = p.invert([MC.W / 2, MC.H / 2]);
    return { lon: ctr[0], lat: clamp(ctr[1], -84, 84), k: p.scale() };
  };
  MC.fitScope = function (scope, key) {
    key = key || MC.state.projection;
    const L = MC.state.layout, padY = L.title.show ? 90 : 55, pad = 55, P = MC.PROJ[key];
    if (scope.type === 'blank') return { lon: 0, lat: 0, k: MC.W / ((90 * Math.PI) / 180) };
    if (scope.type === 'world') {
      const pts = key === 'mercator' ? boxPoints(-180, -58, 180, 80) : boxPoints(-180, -90, 180, 90);
      return key === 'orthographic' ? { lon: 20, lat: 15, k: Math.min(MC.W, MC.H) / 2 - 40 } : MC.fitPoints(pts, key, pad, padY, [0, 0]);
    }
    if (scope.type === 'continent') {
      if (scope.id === 'Antarctica') return { lon: 0, lat: -90, k: ((Math.min(MC.W, MC.H) / 2 - 60) / (2 * Math.tan((14 * Math.PI) / 180 / 1))) * 1 };
      const b = MC.SCOPE_BOXES[scope.id];
      return MC.fitPoints(boxPoints(b[0], b[1], b[2], b[3]), key, pad, padY);
    }
    const f = MC.byA.get(scope.id);
    if (!f) return MC.state.view;
    const pts = regionPoints(f);
    if (P.az && key !== 'orthographic') return MC.fitPoints(pts, key, pad, padY);
    return MC.fitPoints(pts, key, pad + 15, padY + 10);
  };

  MC.setScope = async function (scope, animate) {
    const st = MC.state, prev = st.projection;
    if (MC.cancelFly) MC.cancelFly();
    st.scope = scope;
    if (st.autoProj) st.projection = MC.autoProj(scope);
    if (scope.type === 'country' && st.admin1) await MC.loadAdmin1();
    const v = MC.fitScope(scope);
    MC.sel = null;
    if (animate === false) { MC.setView(v); MC.emit('scope'); MC.commit(); return; }
    if (st.projection !== prev) MC.fadeTo(() => { MC.setView(v); });
    else MC.flyTo(v);
    MC.emit('scope'); MC.commit();
  };
  MC.resetView = function () {
    const st = MC.state;
    if (st.autoProj) st.projection = MC.autoProj(st.scope);
    MC.flyTo(MC.fitScope(st.scope));
  };
  MC.setProjection = function (key, manual) {
    const st = MC.state;
    if (manual) st.autoProj = false;
    st.projection = key;
    const v = st.view;
    const P = MC.PROJ[key];
    const nv = P.az ? { lon: v.lon, lat: clamp(v.lat, -90, 90), k: Math.min(v.k, Math.min(MC.W, MC.H) / 2 - 20) } : v;
    MC.fadeTo(() => { MC.setView(key === 'orthographic' || P.az ? MC.fitScope(st.scope, key) : nv); });
    MC.emit('scope'); MC.commit();
  };

  /* ---------- layout kanvas ---------- */
  MC.layoutPage = function () {
    const wrap = document.getElementById('canvasWrap'), page = document.getElementById('page');
    const cw = wrap.clientWidth - 24, ch = wrap.clientHeight - 24;
    if (cw < 50 || ch < 50) return;
    const asp = MC.state.layout.aspect;
    let w = cw, h = ch;
    if (asp) { if (cw / ch > asp) { h = ch; w = ch * asp; } else { w = cw; h = cw / asp; } }
    w = Math.round(w); h = Math.round(h);
    page.style.width = w + 'px'; page.style.height = h + 'px';
    const changed = w !== MC.W || h !== MC.H;
    MC.W = w; MC.H = h;
    MC.svg.setAttribute('viewBox', `0 0 ${w} ${h}`); MC.svg.setAttribute('width', w); MC.svg.setAttribute('height', h);
    MC.syncProj(); MC.invalidate('all');
    return changed;
  };

  /* ---------- history / persistence ---------- */
  const H = { stack: [], idx: -1 };
  MC.snap = () => JSON.stringify(MC.state, function (k, v) { return k[0] === '_' || (this === MC.state && k === 'view') ? undefined : v; });
  MC.commit = function () {
    const s = MC.snap();
    if (s === H.stack[H.idx]) return;
    H.stack.length = H.idx + 1; H.stack.push(s); H.idx++;
    if (H.stack.length > 100) { H.stack.shift(); H.idx--; }
    MC.persist(); MC.emit('history');
  };
  MC.canUndo = () => H.idx > 0; MC.canRedo = () => H.idx < H.stack.length - 1;
  function restore(s) {
    const d = JSON.parse(s), st = MC.state, oldScope = JSON.stringify(st.scope), oldProj = st.projection;
    const view = st.view;
    Object.keys(st).forEach((k) => delete st[k]);
    Object.assign(st, mergeDefaults(MC.defaultDoc(), d), { view });
    if (MC.sel && MC.sel.kind === 'obj' && !MC.getObj(MC.sel.id)) MC.sel = null;
    if (JSON.stringify(st.scope) !== oldScope || st.projection !== oldProj) MC.setView(MC.fitScope(st.scope)); else MC.syncProj();
    MC.state.objects.forEach(MC.touch);
    MC.invalidate('all'); MC.emit('restore'); MC.persist();
    if (st.scope.type === 'country' && st.admin1) MC.loadAdmin1();
  }
  MC.undo = () => { if (MC.canUndo()) { H.idx--; restore(H.stack[H.idx]); MC.emit('history'); } };
  MC.redo = () => { if (MC.canRedo()) { H.idx++; restore(H.stack[H.idx]); MC.emit('history'); } };
  MC.resetHistory = () => { H.stack = []; H.idx = -1; MC.commit(); };

  let pt = 0;
  MC.persist = function () {
    clearTimeout(pt);
    pt = setTimeout(() => {
      try { localStorage.setItem('mapcreator.autosave', JSON.stringify(MC.state, (k, v) => (k[0] === '_' ? undefined : v))); } catch (e) {}
    }, 500);
  };
  MC.loadDoc = function (d) {
    const st = MC.state;
    const merged = mergeDefaults(MC.defaultDoc(), d);
    Object.keys(st).forEach((k) => delete st[k]);
    Object.assign(st, merged);
    st.objects.forEach((o) => { MC.touch(o); const n = parseInt(String(o.id).replace(/\D/g, ''), 10); if (n > MC._id) MC._id = n; });
    MC.sel = null;
    MC.syncProj(); MC.invalidate('all');
    if (st.scope.type === 'country' && st.admin1) MC.loadAdmin1();
    MC.emit('restore');
  };

  /* ---------- util ---------- */
  MC.toast = function (msg, ms) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(MC._tt); MC._tt = setTimeout(() => t.classList.remove('show'), ms || 2200);
  };
  MC.slug = (s) => String(s || 'peta').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'peta';
  MC.distKm = (a, b) => d3.geoDistance(a, b) * 6371.0088;
  MC.pathKm = (pts) => pts.reduce((s, p, i) => (i ? s + MC.distKm(pts[i - 1], p) : 0), 0);
  MC.fmtKm = (km) => (km < 1 ? Math.round(km * 1000) + ' m' : km < 100 ? km.toFixed(1) + ' km' : Math.round(km).toLocaleString('id-ID') + ' km');
  MC.simplifyPx = function (pts, tol) { // Douglas-Peucker
    if (pts.length < 3) return pts;
    const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
    (function rec(a, b) {
      let md = 0, mi = -1;
      const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L; if (d > md) { md = d; mi = i; } }
      if (md > tol) { keep[mi] = true; rec(a, mi); rec(mi, b); }
    })(0, pts.length - 1);
    return pts.filter((_, i) => keep[i]);
  };
})(window.MC);
