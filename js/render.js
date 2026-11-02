/* Rendering: peta dasar, objek pengguna, dekorasi, overlay UI */
(function (MC) {
  const NS = 'http://www.w3.org/2000/svg';
  const E = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  MC.E = E;
  const clamp = MC.clamp;
  const pools = { c: new Map(), a: new Map(), lab: new Map(), city: new Map() };
  MC.objEls = new Map();

  function sync(parent, map, items, key, create, update) {
    const seen = new Set();
    for (const it of items) {
      const k = key(it); seen.add(k);
      let el = map.get(k);
      if (!el) { el = create(it); map.set(k, el); parent.appendChild(el); }
      update(el, it);
    }
    for (const [k, el] of map) if (!seen.has(k)) { el.remove(); map.delete(k); }
  }

  MC.initSvg = function () {
    const svg = (MC.svg = document.getElementById('map'));
    svg.innerHTML = '';
    svg.setAttribute('xmlns', NS);
    const defs = (MC.defs = E('defs', null, svg));
    E('style', { id: 'animStyle' }, defs).textContent = MC.ANIM_CSS;
    const f = E('filter', { id: 'shadow', x: '-10%', y: '-10%', width: '130%', height: '130%' }, defs);
    E('feDropShadow', { dx: 0, dy: 2, stdDeviation: 3, 'flood-color': '#000', 'flood-opacity': 0.35 }, f);
    const f2 = E('filter', { id: 'mshadow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    E('feDropShadow', { dx: 0, dy: 1, stdDeviation: 1.2, 'flood-color': '#000', 'flood-opacity': 0.45 }, f2);
    const L = (MC.L = {});
    ['bg', 'sphere', 'grat', 'land', 'admin', 'lakes', 'real', 'blabels', 'cities', 'user', 'deco', 'scale', 'ui'].forEach((n) => (L[n] = E('g', { id: 'g-' + n }, svg)));
    L.bgRect = E('rect', { x: 0, y: 0, width: '100%', height: '100%' }, L.bg);
    L.spherePath = E('path', null, L.sphere);
    L.gratPath = E('path', { fill: 'none', 'stroke-width': 0.6, 'stroke-opacity': 0.55 }, L.grat);
    L.lakePath = E('path', null, L.lakes);
    L.ui.setAttribute('data-ui', '1');
    L.ui.style.pointerEvents = 'none';
    L.deco.style.pointerEvents = 'none'; L.scale.style.pointerEvents = 'none';
    L.blabels.style.pointerEvents = 'none'; L.real.style.pointerEvents = 'none'; L.cities.style.pointerEvents = 'none';
  };

  const patCache = new Set();
  const PATS = {
    hatch: (c) => `<path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="${c}" stroke-width="1" fill="none"/>`,
    cross: (c) => `<path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2 M-1,7 l2,2 M0,0 l8,8 M7,-1 l2,2" stroke="${c}" stroke-width=".8" fill="none"/>`,
    dots: (c) => `<circle cx="2" cy="2" r="1.1" fill="${c}"/><circle cx="6" cy="6" r="1.1" fill="${c}"/>`,
    lines: (c) => `<path d="M0,2 H8 M0,6 H8" stroke="${c}" stroke-width="1" fill="none"/>`,
    waves: (c) => `<path d="M0,5 q2,-3 4,0 t4,0" stroke="${c}" stroke-width="1" fill="none"/>`
  };
  function patternId(kind, color) {
    const id = 'pat-' + kind + '-' + color.replace(/[^a-z0-9]/gi, '');
    if (!patCache.has(id)) {
      patCache.add(id);
      const p = E('pattern', { id, width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, MC.defs);
      p.innerHTML = PATS[kind](color);
    }
    return id;
  }

  /* ================= MAIN RENDER ================= */
  MC.render = function () {
    if (!MC.proj || MC._projKey !== MC.state.projection) MC.syncProj();
    MC._projKey = MC.state.projection;
    const D = MC.dirty; MC.dirty = {};
    if (D.base) MC.renderBase();
    if (D.real) MC.renderReal();
    if (D.cities || D.base) MC.renderCities();
    if (D.user) MC.renderUser();
    if (D.deco) MC.renderDeco();
    if (D.scale || D.deco) MC.renderScale();
    if (D.ui || D.user) MC.renderUI();
    MC.updateStatus && MC.updateStatus();
  };

  /* ================= BASE MAP ================= */
  MC.paletteOf = () => MC.PALETTES[(MC.THEMES[MC.state.theme] || {}).pal || 'pastel'];

  MC.renderBase = function () {
    const st = MC.state, S = st.style, L = MC.L, sc = st.scope, P = MC.PROJ[st.projection], v = st.view;
    const path = (MC.path = d3.geoPath(MC.proj));
    const pal = MC.paletteOf();
    L.bgRect.setAttribute('fill', P.rect ? S.ocean : S.pageBg);
    L.spherePath.setAttribute('d', path({ type: 'Sphere' }) || '');
    L.spherePath.setAttribute('fill', S.ocean);
    L.spherePath.setAttribute('stroke', P.az ? S.border : 'none');
    const blank = sc.type === 'blank';
    // graticule
    if (S.graticule) {
      const step = v.k > 3000 ? 1 : v.k > 1200 ? 5 : v.k > 500 ? 10 : v.k > 220 ? 15 : 30;
      L.gratPath.setAttribute('d', path(d3.geoGraticule().step([step, step])()) || '');
      L.gratPath.setAttribute('stroke', S.gratColor);
    } else L.gratPath.setAttribute('d', '');
    L.land.setAttribute('filter', S.shadow ? 'url(#shadow)' : 'none');

    // negara
    const feats = [];
    if (!blank) {
      for (const f of MC.countries) {
        const c = f.properties.c;
        if (st.isolate && ((sc.type === 'continent' && c !== sc.id) || (sc.type === 'country' && f.properties.a !== sc.id))) continue;
        if (st.projection === 'mercator' && c === 'Antarctica' && !(sc.type === 'continent' && sc.id === 'Antarctica')) continue;
        feats.push(f);
      }
    }
    const isDim = (f) => (sc.type === 'country' && f.properties.a !== sc.id) || (sc.type === 'continent' && f.properties.c !== sc.id);
    const showAdm = st.admin1 && MC.admin1 && !blank && (sc.type === 'country' || v.k > 900);
    if (st.admin1 && !MC.admin1 && !blank && v.k > 900 && !MC._a1p) MC.loadAdmin1();
    const ov = st.overrides;
    sync(L.land, pools.c, feats, (f) => f.key, (f) => E('path', { class: 'feat', 'data-bid': f.key, 'data-bn': f.name, 'data-lv': 'country' }),
      (e, f) => {
        const d = path(f) || '';
        e.setAttribute('d', d);
        if (!d) { e.style.display = 'none'; return; }
        e.style.display = '';
        const o = ov[f.key] || {};
        const dim = isDim(f), cur = sc.type === 'country' && f.properties.a === sc.id;
        e.setAttribute('fill', o.fill || (dim ? S.dim : S.colorize ? pal[f.color % pal.length] : S.land));
        e.setAttribute('stroke', o.stroke || S.border);
        e.setAttribute('stroke-width', cur ? S.bw * 2.2 : S.bw);
        e.setAttribute('stroke-linejoin', 'round');
      });

    // provinsi
    let adm = [];
    if (showAdm) {
      if (sc.type === 'country') adm = MC.a1By.get(sc.id) || [];
      else {
        for (const f of MC.admin1) { const cf = MC.byA.get(f.properties.a); if (!cf) continue; if (st.isolate && ((sc.type === 'continent' && cf.properties.c !== sc.id))) continue; adm.push(f); }
      }
    }
    const fillAdm = sc.type === 'country';
    sync(L.admin, pools.a, adm, (f) => f.key, (f) => E('path', { class: 'feat', 'data-bid': f.key, 'data-bn': f.name, 'data-lv': 'admin' }),
      (e, f) => {
        const d = path(f) || '';
        e.setAttribute('d', d);
        if (!d) { e.style.display = 'none'; return; }
        e.style.display = '';
        const o = ov[f.key] || {};
        if (fillAdm) e.setAttribute('fill', o.fill || (S.colorize ? pal[(f.color + 1) % pal.length] : S.land));
        else { e.setAttribute('fill', o.fill || '#000'); e.setAttribute('fill-opacity', o.fill ? 1 : 0); }
        if (fillAdm) e.removeAttribute('fill-opacity');
        e.setAttribute('stroke', o.stroke || S.adminBorder);
        e.setAttribute('stroke-width', S.aw);
        e.setAttribute('stroke-linejoin', 'round');
      });

    // danau
    if (S.lakes && !blank) {
      L.lakePath.setAttribute('d', path(MC.lakes) || '');
      L.lakePath.setAttribute('fill', S.ocean); L.lakePath.setAttribute('stroke', S.border); L.lakePath.setAttribute('stroke-width', 0.4);
    } else L.lakePath.setAttribute('d', '');

    // label wilayah
    const labels = [];
    const addLabel = (f, size0, op) => {
      MC.prep(f);
      const pt = MC.px(f._c); if (!pt) return;
      if (pt[0] < -10 || pt[0] > MC.W + 10 || pt[1] < -10 || pt[1] > MC.H + 10) return;
      const w = Math.sqrt(f._area) * v.k, name = (ov[f.key] && ov[f.key].label) || f.name;
      if (ov[f.key] && ov[f.key].hideLabel) return;
      if (w < name.length * 4.4) return;
      const size = clamp(w / (name.length * 0.66), 8, size0) * S.labelSize;
      labels.push({ key: f.key, x: pt[0], y: pt[1], t: name, size, op });
    };
    if (!blank) {
      if (S.countryLabels) for (const f of feats) { const dim = isDim(f); if (sc.type === 'country' && showAdm && !dim) continue; addLabel(f, dim ? 12 : 17, dim ? 0.55 : 1); }
      if (S.adminLabels && showAdm) for (const f of adm) addLabel(f, 13, 0.85);
    }
    sync(L.blabels, pools.lab, labels, (l) => l.key, () => {
      const t = E('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'stroke-linejoin': 'round' });
      t.style.paintOrder = 'stroke'; return t;
    }, (e, l) => {
      e.setAttribute('x', l.x.toFixed(1)); e.setAttribute('y', l.y.toFixed(1));
      e.setAttribute('font-size', l.size.toFixed(1)); e.setAttribute('font-family', S.font);
      e.setAttribute('fill', S.text); e.setAttribute('stroke', S.halo); e.setAttribute('stroke-width', 2.4); e.setAttribute('opacity', l.op);
      if (e.textContent !== l.t) e.textContent = l.t;
    });
  };

  /* ---------- kota otomatis ---------- */
  MC.renderCities = function () {
    const st = MC.state, S = st.style, sc = st.scope, v = st.view, L = MC.L;
    if (!S.cities || sc.type === 'blank' || !MC.cities) { sync(L.cities, pools.city, [], (x) => x, null, null); return; }
    const z = v.k / (MC.W / 5.6), minPop = 1.8e7 / Math.pow(z, 1.4);
    const out = [], boxes = [], iso = st.isolate;
    for (const c of MC.cities) {
      if (out.length >= 160) break;
      if (sc.type === 'country' && c.a !== sc.id) continue;
      if (sc.type === 'continent' && iso && c.c !== sc.id) continue;
      if (c.pop < minPop * (c.cap ? 0.3 : 1)) continue;
      const p = MC.px(c.ll); if (!p || p[0] < 8 || p[0] > MC.W - 8 || p[1] < 8 || p[1] > MC.H - 8) continue;
      const size = c.cap ? 11 : 10, w = c.n.length * size * 0.56 + 8;
      const b = [p[0] - 4, p[1] - size * 0.7, p[0] + w, p[1] + size * 0.7];
      if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
      boxes.push(b); out.push({ key: c.n + c.ll[0], x: p[0], y: p[1], t: c.n, cap: c.cap, size });
    }
    sync(L.cities, pools.city, out, (c) => c.key, () => {
      const g = E('g'); E('circle', null, g); const t = E('text', { 'dominant-baseline': 'central', x: 6, 'stroke-linejoin': 'round' }, g); t.style.paintOrder = 'stroke'; return g;
    }, (g, c) => {
      g.setAttribute('transform', `translate(${c.x.toFixed(1)},${c.y.toFixed(1)})`);
      const ci = g.firstChild, t = g.lastChild;
      ci.setAttribute('r', c.cap ? 3.4 : 2.3); ci.setAttribute('fill', c.cap ? S.text : S.text); ci.setAttribute('stroke', S.halo); ci.setAttribute('stroke-width', 1);
      if (c.cap) ci.setAttribute('fill', '#d81b60');
      t.setAttribute('font-size', c.size); t.setAttribute('font-family', S.font); t.setAttribute('fill', S.text); t.setAttribute('stroke', S.halo); t.setAttribute('stroke-width', 2.2);
      t.setAttribute('font-weight', c.cap ? 'bold' : 'normal');
      if (t.textContent !== c.t) t.textContent = c.t;
    });
  };

  /* ================= USER OBJECTS ================= */
  const lineGen = (smooth, closed) => d3.line().curve(smooth ? (closed ? d3.curveCatmullRomClosed.alpha(0.5) : d3.curveCatmullRom.alpha(0.5)) : closed ? d3.curveLinearClosed : d3.curveLinear).defined((p) => p !== null);
  const halo = (t, color, w) => { t.setAttribute('stroke', color); t.setAttribute('stroke-width', w); t.setAttribute('stroke-linejoin', 'round'); t.style.paintOrder = 'stroke'; };

  function dashSum(d) { return d.split(/[ ,]+/).map(Number).filter((n) => !isNaN(n)).reduce((a, b, _, arr) => a + b, 0) * (d.split(/[ ,]+/).length % 2 ? 2 : 1); }

  /* --- marker --- */
  MC.markerShape = function (o, parent, size) {
    const s = size || o.size, c = o.color, st = o.stroke, sw = o.sw == null ? 1.6 : o.sw;
    const a = { fill: c, stroke: st, 'stroke-width': sw, 'stroke-linejoin': 'round' };
    switch (o.shape) {
      case 'square': return E('rect', Object.assign({ x: -s / 2, y: -s / 2, width: s, height: s, rx: 1.5 }, a), parent);
      case 'diamond': return E('polygon', Object.assign({ points: `0,${-s * 0.62} ${s * 0.62},0 0,${s * 0.62} ${-s * 0.62},0` }, a), parent);
      case 'triangle': return E('polygon', Object.assign({ points: `0,${-s * 0.62} ${s * 0.58},${s * 0.42} ${-s * 0.58},${s * 0.42}` }, a), parent);
      case 'star': return E('path', Object.assign({ d: d3.symbol().type(d3.symbolStar).size(s * s * 0.95)() }, a), parent);
      case 'pin': {
        const g = E('g', null, parent);
        E('path', Object.assign({ d: `M0,0 C${-s * 0.62},${-s * 0.55} ${-s * 0.52},${-s * 1.12} 0,${-s * 1.12} C${s * 0.52},${-s * 1.12} ${s * 0.62},${-s * 0.55} 0,0 Z` }, a), g);
        E('circle', { cx: 0, cy: -s * 0.72, r: s * 0.17, fill: st }, g);
        return g;
      }
      case 'icon': {
        const g = E('g', null, parent);
        E('circle', Object.assign({ r: s * 0.62 }, a), g);
        const ig = E('g', { transform: `scale(${(s * 0.8) / 24}) translate(-12,-12)`, fill: 'none', stroke: o.iconColor || '#ffffff', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
        ig.innerHTML = MC.LUCIDE[o.icon || 'star'] || '';
        return g;
      }
      case 'glyph': {
        const t = E('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': s, y: 1 }, parent);
        t.textContent = o.glyph || '⭐'; return t;
      }
      default: return E('circle', Object.assign({ r: s / 2 }, a), parent);
    }
  };
  function buildMarker(o, g) {
    g.innerHTML = '';
    const r = (g._r = {});
    g.style.opacity = o.opacity == null ? 1 : o.opacity;
    const wrapOuter = E('g', null, g); r.outer = wrapOuter;
    const anim = o.anim || 'none';
    const cy = o.shape === 'pin' ? -o.size * 0.5 : 0;
    if (anim === 'ripple') {
      for (let i = 0; i < 2; i++) { const c = E('circle', { class: 'a-ripple', cx: 0, cy: o.shape === 'pin' ? 0 : 0, r: Math.max(8, o.size * 0.75), fill: 'none', stroke: o.color, 'stroke-width': 2 }, wrapOuter); c.style.animationDelay = i * 1.1 + 's'; }
    }
    const wrap = E('g', null, wrapOuter);
    wrap.style.filter = 'url(#mshadow)';
    if (['bounce', 'pulse', 'spin'].includes(anim)) { const aw = E('g', { class: 'a-' + anim }, wrap); r.shape = MC.markerShape(o, aw); } else r.shape = MC.markerShape(o, wrap);
    if (o._pop) { wrapOuter.setAttribute('class', 'a-pop'); o._pop = false; }
    if (o.label) {
      const t = E('text', { 'font-family': o.font || 'Georgia', 'font-size': o.lbl, 'font-weight': o.bold ? 'bold' : 'normal', fill: o.lblColor || '#222' }, g);
      halo(t, o.lblHalo || '#ffffff', Math.max(2.2, o.lbl / 4.5));
      const off = (o.shape === 'pin' ? o.size * 0.35 : o.shape === 'icon' ? o.size * 0.62 : o.size * 0.5) + 5, pos = o.lblPos || 'r', lines = String(o.label).split('\n');
      let x = 0, y = cy, anchor = 'start';
      if (pos === 'r') { x = off; anchor = 'start'; } else if (pos === 'l') { x = -off; anchor = 'end'; }
      else if (pos === 't') { y = o.shape === 'pin' ? -o.size * 1.12 - 7 : -off - 2; anchor = 'middle'; } else { y = (o.shape === 'pin' ? 0 : off) + o.lbl * 0.8 + 2; anchor = 'middle'; }
      t.setAttribute('text-anchor', anchor);
      lines.forEach((ln, i) => { const ts = E('tspan', { x, y: y + (i - (pos === 't' ? lines.length - 1 : pos === 'b' ? 0 : (lines.length - 1) / 2)) * o.lbl * 1.15, 'dominant-baseline': pos === 'r' || pos === 'l' ? 'central' : 'auto' }, t); ts.textContent = ln; });
    }
    E('circle', { class: 'hit', cx: 0, cy, r: Math.max(12, o.size * 0.7), fill: 'transparent' }, g);
  }
  function posMarker(o, g) {
    const p = MC.px(o.pos);
    if (!p) { g.style.display = 'none'; return; }
    g.setAttribute('transform', `translate(${p[0].toFixed(1)},${p[1].toFixed(1)})`);
  }

  /* --- line --- */
  function buildLine(o, g) {
    g.innerHTML = '';
    const r = (g._r = {}), anim = o.anim || 'none';
    g.style.opacity = o.opacity == null ? 1 : o.opacity;
    r.hit = E('path', { class: 'hit', fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(14, o.w + 10), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const dashed = !!o.dash && anim !== 'draw';
    const cap = dashed ? 'butt' : 'round';
    const draw = anim === 'draw';
    if (o.cw > 0) { r.casing = E('path', { fill: 'none', stroke: o.cc, 'stroke-width': o.cw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g); if (draw) { r.casing.setAttribute('pathLength', 1); r.casing.setAttribute('class', 'a-draw'); } }
    r.main = E('path', { fill: 'none', stroke: o.color, 'stroke-width': o.w, 'stroke-linecap': cap, 'stroke-linejoin': 'round' }, g);
    if (dashed || anim === 'flow') {
      const d = o.dash || '8 6';
      r.main.setAttribute('stroke-dasharray', d);
      if (anim === 'flow') { r.main.setAttribute('class', 'a-flow'); r.main.style.setProperty('--dp', -dashSum(d) + 'px'); r.main.style.animationDuration = Math.max(0.4, (o.speed || 1) ? 1 / (o.speed || 1) : 1) + 's'; }
    }
    if (draw) { r.main.setAttribute('pathLength', 1); r.main.setAttribute('class', 'a-draw'); }
    if (o.center) { r.center = E('path', { fill: 'none', stroke: o.center, 'stroke-width': o.centerW || 1.2, 'stroke-dasharray': o.centerDash || '8 6', 'stroke-linecap': 'butt' }, g); }
    if (anim === 'glow') { g.setAttribute('class', (g.getAttribute('class') || '').replace(/ ?a-glow/g, '') + ' a-glow'); g.style.color = o.color; }
    if (o.arrow && o.arrow !== 'none') {
      r.arrowEnd = E('path', { fill: o.color, stroke: o.cw > 0 ? o.cc : 'none', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }, g);
      if (o.arrow === 'both') r.arrowStart = E('path', { fill: o.color, stroke: o.cw > 0 ? o.cc : 'none', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }, g);
    }
    if (o.label) {
      r.lblPath = E('path', { id: 'tp-' + o.id, fill: 'none', stroke: 'none' }, g);
      const t = E('text', { 'font-family': o.font || 'Georgia', 'font-size': o.lbl || 12, 'font-weight': o.bold ? 'bold' : 'normal', fill: o.lblColor || '#222', 'text-anchor': 'middle', dy: -((o.w + (o.cw > o.w ? 0 : 0)) / 2 + 3) }, g);
      halo(t, o.lblHalo || '#ffffff', 2.6);
      const tp = E('textPath', { startOffset: '50%' }, t);
      tp.setAttribute('href', '#tp-' + o.id); tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#tp-' + o.id);
      tp.textContent = o.label; r.text = t;
    }
  }
  function ptsPx(o) { return o.pts.map((p) => MC.px(p)); }
  function arrowPath(x, y, ang, s) {
    const c = Math.cos(ang), n = Math.sin(ang), pt = (u, w) => `${(x + u * c - w * n).toFixed(1)},${(y + u * n + w * c).toFixed(1)}`;
    return `M${pt(0, 0)} L${pt(-s, -s * 0.5)} L${pt(-s * 0.7, 0)} L${pt(-s, s * 0.5)} Z`;
  }
  function posLine(o, g) {
    const r = g._r, px = ptsPx(o);
    if (px.filter(Boolean).length < 2) { g.style.display = 'none'; return; }
    const d = lineGen(o.smooth, false)(px) || '';
    r.hit.setAttribute('d', d); r.main.setAttribute('d', d);
    if (r.casing) r.casing.setAttribute('d', d);
    if (r.center) r.center.setAttribute('d', d);
    if (r.lblPath) {
      const rev = (px[px.length - 1] || [0])[0] < (px[0] || [0])[0] ? px.slice().reverse() : px;
      r.lblPath.setAttribute('d', lineGen(o.smooth, false)(rev) || '');
    }
    if (r.arrowEnd) {
      const len = r.main.getTotalLength ? r.main.getTotalLength() : 0, s = Math.max(9, o.w * 3.4);
      if (len > s * 1.2) {
        const e = r.main.getPointAtLength(len), e2 = r.main.getPointAtLength(len - s * 0.8);
        r.arrowEnd.setAttribute('d', arrowPath(e.x, e.y, Math.atan2(e.y - e2.y, e.x - e2.x), s));
        if (r.arrowStart) { const a = r.main.getPointAtLength(0), a2 = r.main.getPointAtLength(s * 0.8); r.arrowStart.setAttribute('d', arrowPath(a.x, a.y, Math.atan2(a.y - a2.y, a.x - a2.x), s)); }
      }
    }
  }

  /* --- zone --- */
  function buildZone(o, g) {
    g.innerHTML = '';
    const r = (g._r = {}), anim = o.anim || 'none';
    g.style.opacity = o.opacity == null ? 1 : o.opacity;
    r.fill = E('path', { fill: o.fill, 'fill-opacity': o.fillOp == null ? 1 : o.fillOp, stroke: o.stroke, 'stroke-width': o.sw, 'stroke-dasharray': o.dash || null, 'stroke-linejoin': 'round' }, g);
    if (o.pattern && o.pattern !== 'none') r.pat = E('path', { fill: `url(#${patternId(o.pattern, o.pc || '#00000055')})`, stroke: 'none', 'pointer-events': 'none' }, g);
    if (anim === 'breathe' || anim === 'glow') { g.setAttribute('class', 'obj obj-zone a-' + anim); g.style.color = o.fill; }
    if (o.label) {
      r.text = E('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': o.font || 'Georgia', 'font-size': o.lbl || 14, 'font-weight': o.bold ? 'bold' : 'normal', fill: o.lblColor || '#222', 'pointer-events': 'none' }, g);
      halo(r.text, o.lblHalo || '#ffffff', 3);
      r.text.textContent = o.label;
    }
  }
  function posZone(o, g) {
    const r = g._r, px = ptsPx(o);
    if (px.some((p) => !p) || px.length < 3) { g.style.display = 'none'; return; }
    const d = lineGen(o.smooth, true)(px) || '';
    r.fill.setAttribute('d', d); if (r.pat) r.pat.setAttribute('d', d);
    if (r.text) { const c = d3.polygonCentroid(px); r.text.setAttribute('x', c[0].toFixed(1)); r.text.setAttribute('y', c[1].toFixed(1)); }
  }

  /* --- text --- */
  function buildText(o, g) {
    g.innerHTML = '';
    const r = (g._r = {});
    g.style.opacity = o.opacity == null ? 1 : o.opacity;
    r.inner = E('g', null, g);
    const t = (r.text = E('text', { 'font-family': o.font || 'Georgia', 'font-size': o.size, 'font-weight': o.bold ? 'bold' : 'normal', 'font-style': o.italic ? 'italic' : 'normal', fill: o.color, 'text-anchor': o.align === 'l' ? 'start' : o.align === 'r' ? 'end' : 'middle', 'letter-spacing': o.spacing || 0 }, r.inner));
    if (o.halo !== false) halo(t, o.haloColor || '#ffffff', Math.max(2, o.size / 5));
    const lines = String(o.text || '').split('\n');
    lines.forEach((ln, i) => { const ts = E('tspan', { x: 0, y: (i - (lines.length - 1) / 2) * o.size * 1.18, 'dominant-baseline': 'central' }, t); ts.textContent = ln || ' '; });
    if (o.anim === 'float' || o.anim === 'blink') r.inner.setAttribute('class', 'a-' + o.anim);
    const bb = t.getBBox();
    E('rect', { class: 'hit', x: bb.x - 4, y: bb.y - 4, width: bb.width + 8, height: bb.height + 8, fill: 'transparent' }, r.inner);
  }
  function posText(o, g) {
    const p = MC.px(o.pos);
    if (!p) { g.style.display = 'none'; return; }
    g.setAttribute('transform', `translate(${p[0].toFixed(1)},${p[1].toFixed(1)}) rotate(${o.rot || 0})`);
  }

  const BUILD = { marker: buildMarker, line: buildLine, zone: buildZone, text: buildText };
  const POS = { marker: posMarker, line: posLine, zone: posZone, text: posText };

  MC.renderUser = function () {
    const gU = MC.L.user, objs = MC.state.objects, seen = new Set();
    objs.forEach((o, i) => {
      let g = MC.objEls.get(o.id);
      if (!g) { g = E('g', { 'data-oid': o.id, class: 'obj obj-' + o.type }); MC.objEls.set(o.id, g); }
      if (gU.children[i] !== g) gU.insertBefore(g, gU.children[i] || null);
      seen.add(o.id);
      if (g._v !== o._v) { g.removeAttribute('style'); g.setAttribute('class', 'obj obj-' + o.type); g.style.display = ''; BUILD[o.type](o, g); g._v = o._v; }
      if (o.visible === false) { g.style.display = 'none'; return; }
      g.style.display = '';
      POS[o.type](o, g);
    });
    for (const [id, el] of MC.objEls) if (!seen.has(id)) { el.remove(); MC.objEls.delete(id); }
  };

  /* ================= DEKORASI ================= */
  const Tx = (txt, attrs, parent) => { const t = E('text', attrs, parent); t.textContent = txt; return t; };
  MC.frameMargin = () => { const f = MC.state.layout.frame; return f.show ? f.inset + f.width * (f.style === 'double' ? 2.2 : 1) + 8 : 12; };

  function legendEntries() {
    const seen = new Map();
    for (const o of MC.state.objects) {
      if (o.visible === false || o.inLegend === false || o.type === 'text') continue;
      const name = o.legend || (o.type === 'zone' ? (MC.ZONE_TYPES[o.preset] || {}).label : o.type === 'line' ? (MC.LINE_TYPES[o.preset] || {}).label : (MC.MARKER_TYPES[o.preset] || {}).label) || o.name;
      const key = o.type + '|' + name;
      if (!seen.has(key)) seen.set(key, { o, name });
    }
    return [...seen.values()];
  }

  MC.renderDeco = function () {
    const st = MC.state, Ly = st.layout, G = MC.L.deco, W = MC.W, H = MC.H, S = st.style;
    G.innerHTML = '';
    const m = MC.frameMargin();
    // bingkai
    if (Ly.frame.show) {
      const f = Ly.frame, i = f.inset;
      E('rect', { x: i, y: i, width: W - 2 * i, height: H - 2 * i, fill: 'none', stroke: f.color, 'stroke-width': f.width }, G);
      if (f.style === 'double') E('rect', { x: i + f.width * 1.6, y: i + f.width * 1.6, width: W - 2 * (i + f.width * 1.6), height: H - 2 * (i + f.width * 1.6), fill: 'none', stroke: f.color, 'stroke-width': Math.max(0.8, f.width / 4) }, G);
    }
    // judul
    let titleH = 0;
    const T = Ly.title;
    if (T.show && (T.text || T.sub)) {
      const g = E('g', null, G), bg = E('rect', { rx: 6, fill: T.bgColor, 'fill-opacity': T.bg ? T.bgOpacity : 0 }, g);
      const anchor = T.align === 'center' ? 'middle' : T.align === 'right' ? 'end' : 'start';
      const t1 = T.text ? Tx(T.text, { 'font-family': T.font, 'font-size': T.size, 'font-weight': 'bold', fill: T.color, 'text-anchor': anchor, y: T.size }, g) : null;
      const sz2 = Math.max(11, T.size * 0.42);
      const t2 = T.sub ? Tx(T.sub, { 'font-family': T.font, 'font-size': sz2, 'font-style': 'italic', fill: T.color, 'text-anchor': anchor, y: (T.text ? T.size * 1.0 + sz2 * 1.35 : sz2), opacity: 0.8 }, g) : null;
      const bb = g.getBBox(), padX = 14, padY = 8, w = bb.width + padX * 2, h = bb.height + padY * 2;
      const x = T.align === 'center' ? W / 2 : T.align === 'right' ? W - m : m;
      const bx = T.align === 'center' ? x - w / 2 : T.align === 'right' ? x - w : x;
      const by = T.pos === 'bottom' ? H - m - h : m;
      [t1, t2].forEach((t) => { if (t) { t.setAttribute('x', x); } });
      g.setAttribute('transform', `translate(${(T.align === 'right' ? -padX : T.align === 'center' ? 0 : padX).toFixed(1)},${(by + padY - bb.y).toFixed(1)})`);
      bg.setAttribute('x', (bx - (T.align === 'right' ? -padX : T.align === 'center' ? 0 : padX)).toFixed(1)); bg.setAttribute('y', (bb.y - padY).toFixed(1)); bg.setAttribute('width', w.toFixed(1)); bg.setAttribute('height', h.toFixed(1));
      if (T.pos !== 'bottom') titleH = h + 10;
    }
    MC._occ = { tl: T.pos !== 'bottom' && T.show ? titleH : 0, tr: T.pos !== 'bottom' && T.show ? titleH : 0, bl: 0, br: 0 };
    if (T.show && T.pos === 'bottom') { MC._occ.bl = 0; }
    const place = (pos, w, h) => {
      const x = pos[1] === 'l' ? m : W - m - w, top = pos[0] === 't';
      const used = MC._occ[pos];
      const y = top ? m + used : H - m - h - used;
      MC._occ[pos] += h + 10;
      return [x, y];
    };
    // skala (reservasi ruang)
    if (Ly.scalebar.show) place(Ly.scalebar.pos, 0, 38);
    // kompas
    if (Ly.compass.show) {
      const sz = 62, [x, y] = place(Ly.compass.pos, sz, sz);
      const g = E('g', { transform: `translate(${x + sz / 2},${y + sz / 2})` }, G);
      E('circle', { r: sz / 2 - 2, fill: '#ffffff', 'fill-opacity': 0.75, stroke: S.text, 'stroke-width': 1 }, g);
      E('polygon', { points: `0,${-sz / 2 + 7} 7,0 -7,0`, fill: '#d32f2f', stroke: '#222', 'stroke-width': 0.6 }, g);
      E('polygon', { points: `0,${sz / 2 - 7} 7,0 -7,0`, fill: '#ffffff', stroke: '#222', 'stroke-width': 0.6 }, g);
      E('circle', { r: 2, fill: '#222' }, g);
      Tx('U', { y: -sz / 2 - 3, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', 'font-family': 'Arial', fill: '#222', stroke: '#fff', 'stroke-width': 2.5, 'paint-order': 'stroke' }, g);
    }
    // legenda
    const ents = legendEntries();
    if (Ly.legend.show && ents.length) {
      const g = E('g', null, G), bg = E('rect', { rx: 8, fill: '#ffffff', 'fill-opacity': 0.9, stroke: '#00000030' }, g);
      let y = 20;
      Tx(Ly.legend.title, { x: 12, y, 'font-family': 'Arial', 'font-weight': 'bold', 'font-size': 13, fill: '#222' }, g);
      y += 8;
      ents.forEach(({ o, name }) => {
        y += 22;
        const sw = E('g', { transform: `translate(24,${y - 5})` }, g);
        if (o.type === 'zone') {
          E('rect', { x: -12, y: -7, width: 24, height: 14, rx: 2, fill: o.fill, 'fill-opacity': o.fillOp == null ? 1 : o.fillOp, stroke: o.stroke, 'stroke-width': Math.min(1.5, o.sw) }, sw);
          if (o.pattern && o.pattern !== 'none') E('rect', { x: -12, y: -7, width: 24, height: 14, fill: `url(#${patternId(o.pattern, o.pc || '#00000055')})` }, sw);
        } else if (o.type === 'line') {
          const dd = 'M-12,3 L12,-3';
          if (o.cw > 0) E('path', { d: dd, stroke: o.cc, 'stroke-width': Math.min(o.cw, 9), fill: 'none', 'stroke-linecap': 'round' }, sw);
          E('path', { d: dd, stroke: o.color, 'stroke-width': Math.min(o.w, 7), fill: 'none', 'stroke-dasharray': o.dash || null, 'stroke-linecap': o.dash ? 'butt' : 'round' }, sw);
        } else {
          MC.markerShape(o, sw, Math.min(o.size, 18) * (o.shape === 'pin' ? 0.75 : 1));
          if (o.shape === 'pin') sw.firstChild.setAttribute('transform', 'translate(0,7)');
        }
        Tx(name, { x: 44, y: y, 'font-family': 'Arial', 'font-size': 12, fill: '#222' }, g);
      });
      const bb = g.getBBox(), w = Math.max(bb.width + 24, 120), h = y + 14;
      bg.setAttribute('x', 0); bg.setAttribute('y', 0); bg.setAttribute('width', w); bg.setAttribute('height', h);
      const [x, yy] = place(Ly.legend.pos, w, h);
      g.setAttribute('transform', `translate(${x},${yy})`);
    }
    MC.renderAttribution();
  };

  MC.renderAttribution = function () {
    const st = MC.state;
    if (!st.real || !st.real.on || !MC.real.items.length) return;
    const m = MC.frameMargin();
    Tx('© OpenStreetMap contributors', { x: MC.W / 2, y: MC.H - m - 3, 'text-anchor': 'middle', 'font-family': 'Arial', 'font-size': 10, fill: '#222', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }, MC.L.deco);
  };

  MC.renderScale = function () {
    const st = MC.state, G = MC.L.scale, Ly = st.layout.scalebar; G.innerHTML = '';
    if (!Ly.show || !MC.proj) return;
    const m = MC.frameMargin(), W = MC.W, H = MC.H;
    const y0 = H / 2, a = MC.proj.invert([W / 2 - 50, y0]), b = MC.proj.invert([W / 2 + 50, y0]);
    if (!a || !b || !isFinite(a[0]) || !isFinite(b[0])) return;
    const km100 = MC.distKm(a, b); if (!km100 || !isFinite(km100)) return;
    const pow = Math.pow(10, Math.floor(Math.log10(km100))), nice = [5, 2, 1].map((n) => n * pow).find((n) => n <= km100) || pow / 2;
    const w = (nice / km100) * 100, h = 38;
    const pos = Ly.pos, x = pos[1] === 'l' ? m : W - m - w - 20;
    const occ = MC._occ || {}; const stack = (pos[0] === 'b') ? 0 : (occ[pos] || 0);
    const y = pos[0] === 't' ? m + stack : H - m - h;
    const g = E('g', { transform: `translate(${x},${y})` }, G);
    E('rect', { x: -6, y: -2, width: w + 44, height: h, rx: 6, fill: '#fff', 'fill-opacity': 0.8 }, g);
    const half = w / 2;
    E('rect', { x: 0, y: 14, width: half, height: 6, fill: '#222', stroke: '#222', 'stroke-width': 0.8 }, g);
    E('rect', { x: half, y: 14, width: half, height: 6, fill: '#fff', stroke: '#222', 'stroke-width': 0.8 }, g);
    const tk = { 'font-family': 'Arial', 'font-size': 10, fill: '#222', 'text-anchor': 'middle' };
    const nf = (v) => (v >= 1 ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : Math.round(v * 1000) + ' m');
    Tx('0', Object.assign({ x: 0, y: 32 }, tk), g);
    Tx(nf(nice / 2), Object.assign({ x: half, y: 32 }, tk), g);
    Tx(nf(nice) + (nice >= 1 ? ' km' : ''), Object.assign({ x: w + 4, y: 32, 'text-anchor': 'start' }, tk, { 'text-anchor': 'start' }), g);
    Tx('Skala', { x: 0, y: 9, 'font-family': 'Arial', 'font-size': 9, fill: '#555' }, g);
  };

  /* ================= OVERLAY UI ================= */
  const ACC = '#2563eb';
  MC.renderUI = function () {
    const G = MC.L.ui; G.innerHTML = '';
    if (MC.hideUI) return;
    // seleksi base
    if (MC.sel && MC.sel.kind === 'base') {
      const f = MC.sel.level === 'admin' ? (MC.admin1 || []).find((x) => x.key === MC.sel.id) : MC.countries.find((x) => x.key === MC.sel.id);
      if (f && MC.path) E('path', { d: MC.path(f) || '', fill: ACC, 'fill-opacity': 0.12, stroke: ACC, 'stroke-width': 2.2 }, G);
    }
    const o = MC.selObj();
    if (o && o.visible !== false && MC.tool === 'select') {
      const px = o.pts ? ptsPx(o) : null;
      if (o.type === 'marker' || o.type === 'text') {
        const g = MC.objEls.get(o.id); if (g) { const bb = g.getBBox(), p = MC.px(o.pos); if (p) {
          const tr = o.type === 'text' ? o.rot || 0 : 0;
          E('rect', { x: p[0] + bb.x - 3, y: p[1] + bb.y - 3, width: bb.width + 6, height: bb.height + 6, fill: 'none', stroke: ACC, 'stroke-width': 1.5, 'stroke-dasharray': '4 3', rx: 3, transform: o.type === 'text' ? `rotate(${tr} ${p[0]} ${p[1]})` : null }, G);
        } }
      } else if (px) {
        const closed = o.type === 'zone';
        const d = lineGen(o.smooth, closed)(px);
        if (d) E('path', { d, fill: 'none', stroke: ACC, 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: 0.9 }, G);
        px.forEach((p, i) => {
          if (!p) return;
          const nx = px[(i + 1) % px.length];
          if (nx && (closed || i < px.length - 1)) { const mx = (p[0] + nx[0]) / 2, my = (p[1] + nx[1]) / 2; E('circle', { 'data-h': 'm' + i, cx: mx, cy: my, r: 4, fill: '#fff', stroke: ACC, 'stroke-width': 1.2, opacity: 0.8, style: 'pointer-events:all;cursor:copy' }, G); }
        });
        px.forEach((p, i) => { if (p) E('circle', { 'data-h': 'v' + i, cx: p[0], cy: p[1], r: 5.5, fill: '#fff', stroke: ACC, 'stroke-width': 2, style: 'pointer-events:all;cursor:move' }, G); });
      }
    }
    // draft
    const D = MC.draft;
    if (D) {
      const px = (D.pts || []).map((p) => MC.px(p)).filter(Boolean);
      const all = D.cur ? px.concat([D.cur]) : px;
      const closed = D.kind === 'zone';
      if (D.free && D.free.length) E('path', { d: 'M' + D.free.map((p) => p.join(',')).join('L'), fill: closed ? ACC : 'none', 'fill-opacity': 0.15, stroke: ACC, 'stroke-width': 2.2 }, G);
      else if (all.length > 1) {
        const dd = d3.line()(all) + (closed && all.length > 2 ? 'Z' : '');
        E('path', { d: dd, fill: closed ? ACC : 'none', 'fill-opacity': 0.12, stroke: ACC, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, G);
      }
      px.forEach((p, i) => E('circle', { cx: p[0], cy: p[1], r: i === 0 && closed && px.length > 2 ? 7 : 4, fill: i === 0 ? ACC : '#fff', stroke: ACC, 'stroke-width': 2 }, G));
      if (D.shape) E('path', { d: D.shape, fill: ACC, 'fill-opacity': 0.14, stroke: ACC, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, G);
      if (D.label && D.cur) {
        const t = Tx(D.label, { x: D.cur[0] + 14, y: D.cur[1] - 12, 'font-family': 'Arial', 'font-size': 13, 'font-weight': 'bold', fill: '#111', stroke: '#fff', 'stroke-width': 3.5, 'paint-order': 'stroke' }, G);
      }
    }
  };
})(window.MC);
