/* Tools: interaksi pointer, menggambar, edit, keyboard */
(function (MC) {
  const clamp = MC.clamp;
  MC.draft = null;
  MC.drawOpts = { marker: 'city', line: 'street', zone: 'residential', free: false };
  MC.TOOLS = ['select', 'hand', 'marker', 'line', 'zone', 'rect', 'circle', 'text', 'measure'];
  const ptrs = new Map();
  let drag = null, space = false, lastClick = { t: 0, p: [0, 0] };

  const pt = (e) => { const r = MC.svg.getBoundingClientRect(); return [((e.clientX - r.left) * MC.W) / r.width, ((e.clientY - r.top) * MC.H) / r.height]; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const isTyping = (t) => t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

  /* ---------- objek ---------- */
  function baseObj(type, extra) {
    return Object.assign({ id: MC.uid(), type, opacity: 1, visible: true, locked: false, anim: 'none', inLegend: true, font: MC.state.style.font }, extra);
  }
  function add(o, opts) {
    MC.touch(o);
    MC.state.objects.push(o);
    if (MC._batch) return o;
    MC.sel = { kind: 'obj', id: o.id };
    MC.invalidate('objects');
    MC.commit();
    MC.emit('selection', Object.assign({ focus: true }, opts));
    return o;
  }
  MC.createMarker = function (preset, pos) {
    const t = MC.MARKER_TYPES[preset];
    return add(baseObj('marker', { preset, name: t.name, pos, shape: t.shape, glyph: t.glyph, icon: t.icon, size: t.size, color: t.color, stroke: t.stroke, sw: 1.6, label: t.name, lbl: t.lbl, bold: t.bold, lblColor: '#222222', lblHalo: '#ffffff', lblPos: 'r', _pop: true }), { focusField: 'label' });
  };
  MC.createLine = function (preset, pts) {
    const t = MC.LINE_TYPES[preset];
    return add(baseObj('line', { preset, name: t.label, pts, w: t.w, color: t.color, cw: t.cw, cc: t.cc, center: t.center, centerDash: t.centerDash, centerW: t.centerW, dash: t.dash, smooth: t.smooth, arrow: t.arrow || 'none', anim: t.anim || 'none', label: '', lbl: 12, lblColor: '#222222', lblHalo: '#ffffff', bold: false }));
  };
  MC.createZone = function (preset, pts, smooth) {
    const t = MC.ZONE_TYPES[preset];
    return add(baseObj('zone', { preset, name: t.label, pts, fill: t.fill, fillOp: preset === 'land' || preset === 'water' ? 1 : 0.85, stroke: t.stroke, sw: t.sw, dash: '', pattern: t.pattern, pc: t.pc, smooth: !!smooth, label: '', lbl: 14, lblColor: '#222222', lblHalo: '#ffffff', bold: false }));
  };
  MC.createText = function (pos) {
    return add(baseObj('text', { name: 'Teks', pos, text: 'Teks Baru', size: 22, color: '#1f2933', rot: 0, bold: true, italic: false, align: 'c', halo: true, haloColor: '#ffffff', spacing: 0 }), { focusField: 'text' });
  };
  MC.deleteSelected = function () {
    const s = MC.sel; if (!s) return;
    if (s.kind === 'obj') { MC.state.objects = MC.state.objects.filter((o) => o.id !== s.id); }
    else { delete MC.state.overrides[s.id]; }
    MC.sel = null; MC.invalidate('all'); MC.commit(); MC.emit('selection');
  };
  MC.deleteObj = (id) => { MC.state.objects = MC.state.objects.filter((o) => o.id !== id); if (MC.sel && MC.sel.id === id) MC.sel = null; MC.invalidate('all'); MC.commit(); MC.emit('selection'); };
  function shiftObj(o, dx, dy) {
    const move = (p) => { const a = MC.px(p); if (!a) return p; return MC.inv([a[0] + dx, a[1] + dy]) || p; };
    if (o.pts) o.pts = o.pts.map(move); else o.pos = move(o.pos);
    MC.touch(o);
  }
  MC.duplicateSelected = function () {
    const o = MC.selObj(); if (!o) return;
    const c = JSON.parse(JSON.stringify(o, (k, v) => (k[0] === '_' ? undefined : v)));
    c.id = MC.uid(); c.name = (o.name || '') + ' (salinan)'; c._pop = true;
    shiftObj(c, 22, 22);
    MC.state.objects.push(c); MC.touch(c); MC.sel = { kind: 'obj', id: c.id };
    MC.invalidate('objects'); MC.commit(); MC.emit('selection');
  };
  MC.moveObj = function (id, dir) {
    const a = MC.state.objects, i = a.findIndex((o) => o.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; MC.invalidate('objects'); MC.commit(); MC.emit('layers');
  };
  MC.select = function (sel, opts) { MC.sel = sel; MC.invalidate('ui'); MC.emit('selection', opts); };

  /* ---------- tool ---------- */
  MC.setTool = function (t) {
    if (MC.draft && MC.draft.kind !== 'measure') cancelDraft();
    if (t !== 'measure') MC.draft = null;
    MC.tool = t; document.getElementById('page').dataset.tool = t;
    if (t !== 'select' && MC.sel && MC.sel.kind === 'obj') { /* biarkan seleksi, tanpa handle */ }
    MC.invalidate('ui'); MC.emit('tool');
  };
  function cancelDraft() { MC.draft = null; MC.invalidate('ui'); }
  function finishDraft() {
    const D = MC.draft; if (!D) return;
    if (D.kind === 'line' && D.pts.length >= 2) { MC.draft = null; MC.createLine(MC.drawOpts.line, D.pts); MC.setTool('select'); }
    else if (D.kind === 'zone' && D.pts.length >= 3) { MC.draft = null; MC.createZone(MC.drawOpts.zone, D.pts, false); MC.setTool('select'); }
    else if (D.kind === 'measure') { D.done = true; D.cur = null; }
    else cancelDraft();
    MC.invalidate('ui');
  }

  /* ---------- pointer ---------- */
  let pinch = null;
  function startPan(p, extra) {
    MC.cancelFly && MC.cancelFly();
    drag = Object.assign({ type: 'pan', start: p, view0: Object.assign({}, MC.state.view), proj0: MC.proj, moved: false }, extra);
  }
  function onDown(e) {
    MC.cancelFly && MC.cancelFly();
    if (e.target.closest && e.target.closest('#zoomctl')) return;
    MC.svg.setPointerCapture && MC.svg.setPointerCapture(e.pointerId);
    const p = pt(e); ptrs.set(e.pointerId, p);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: dist(a, b), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; drag = null; cancelFreeIfAny(); return; }
    if (e.button === 2) return;
    const tool = MC.tool;
    if (e.button === 1 || space || tool === 'hand') { startPan(p, {}); return; }
    if (tool === 'select') {
      const h = e.target.closest('[data-h]'), o = MC.selObj();
      if (h && o) {
        const k = h.dataset.h, idx = +k.slice(1);
        if (k[0] === 'm') {
          const a = MC.px(o.pts[idx]), b = MC.px(o.pts[(idx + 1) % o.pts.length]);
          const np = a && b && MC.inv([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
          if (np) { o.pts.splice(idx + 1, 0, np); MC.touch(o); drag = { type: 'vertex', id: o.id, idx: idx + 1, moved: true }; MC.invalidate('objects'); }
        } else drag = { type: 'vertex', id: o.id, idx, moved: false };
        return;
      }
      const oe = e.target.closest('[data-oid]');
      if (oe) {
        const ob = MC.getObj(oe.dataset.oid);
        if (ob && !ob.locked) {
          if (!MC.sel || MC.sel.id !== ob.id) MC.select({ kind: 'obj', id: ob.id });
          drag = { type: 'move', id: ob.id, start: p, orig: ob.pts ? ob.pts.map((q) => MC.px(q)) : MC.px(ob.pos), moved: false };
          return;
        }
      }
      const be = e.target.closest('[data-bid]');
      startPan(p, { cand: be ? { kind: 'base', id: be.dataset.bid, name: be.dataset.bn, level: be.dataset.lv } : null });
      return;
    }
    // alat gambar
    const geo = MC.inv(p);
    if (tool === 'marker') { if (geo) MC.createMarker(MC.drawOpts.marker, geo); return; }
    if (tool === 'text') { if (geo) { MC.createText(geo); MC.setTool('select'); } return; }
    if (tool === 'line' || tool === 'zone') {
      if (MC.drawOpts.free) { drag = { type: 'free', pts: [p] }; MC.draft = { kind: tool, pts: [], free: [p], cur: null }; return; }
      if (!geo) return;
      const now = performance.now();
      let D = MC.draft;
      if (D && D.kind === tool && D.pts.length) {
        if (now - lastClick.t < 350 && dist(p, lastClick.p) < 6) { finishDraft(); lastClick = { t: 0, p }; return; }
        if (tool === 'zone' && D.pts.length >= 3) { const f = MC.px(D.pts[0]); if (f && dist(f, p) < 10) { finishDraft(); return; } }
        D.pts.push(geo);
      } else MC.draft = { kind: tool, pts: [geo], cur: p };
      lastClick = { t: now, p };
      MC.invalidate('ui');
      return;
    }
    if (tool === 'rect' || tool === 'circle') { drag = { type: 'shape', kind: tool, start: p }; MC.draft = { kind: 'shape', pts: [], shape: '' }; return; }
    if (tool === 'measure') {
      if (!geo) return;
      if (!MC.draft || MC.draft.done) MC.draft = { kind: 'measure', pts: [], cur: p };
      const now = performance.now();
      if (now - lastClick.t < 350 && dist(p, lastClick.p) < 6) { finishDraft(); return; }
      MC.draft.pts.push(geo); lastClick = { t: now, p }; updateMeasure(p); MC.invalidate('ui');
    }
  }
  function cancelFreeIfAny() { if (drag && drag.type === 'free') { drag = null; cancelDraft(); } }
  function updateMeasure(p) {
    const D = MC.draft; if (!D || D.kind !== 'measure') return;
    let pts = D.pts.slice(); const c = p && MC.inv(p); if (c && !D.done) pts.push(c);
    D.label = pts.length > 1 ? 'Jarak: ' + MC.fmtKm(MC.pathKm(pts)) : 'Klik titik berikutnya';
  }
  function shapePoints(kind, a, b) {
    if (kind === 'rect') return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
    const r = dist(a, b), n = 48; const out = [];
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; out.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]); }
    return out;
  }

  function onMove(e) {
    const p = pt(e);
    MC.lastPointer = p;
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = dist(a, b), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      MC.zoomAt(d / pinch.d, mid[0], mid[1]);
      const proj0 = MC.proj; MC.panFrom(MC.state.view, proj0, mid[0] - pinch.mid[0], mid[1] - pinch.mid[1]);
      pinch = { d, mid }; return;
    }
    if (drag) {
      if (drag.type === 'pan') {
        const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
        if (!drag.moved && Math.hypot(dx, dy) < 3) return;
        drag.moved = true; MC.panFrom(drag.view0, drag.proj0, dx, dy);
        document.getElementById('page').classList.add('grabbing');
      } else if (drag.type === 'move') {
        const o = MC.getObj(drag.id); if (!o) return;
        const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
        if (!drag.moved && Math.hypot(dx, dy) < 3) return;
        drag.moved = true;
        if (o.pts) o.pts = o.pts.map((q, i) => { const a = drag.orig[i]; return a ? MC.inv([a[0] + dx, a[1] + dy]) || q : q; });
        else if (drag.orig) o.pos = MC.inv([drag.orig[0] + dx, drag.orig[1] + dy]) || o.pos;
        MC.touch(o); MC.invalidate('objects');
      } else if (drag.type === 'vertex') {
        const o = MC.getObj(drag.id), g = MC.inv(p); if (!o || !g) return;
        o.pts[drag.idx] = g; drag.moved = true; MC.touch(o); MC.invalidate('objects');
      } else if (drag.type === 'free') {
        const last = drag.pts[drag.pts.length - 1];
        if (dist(last, p) > 3) { drag.pts.push(p); MC.draft.free = drag.pts.slice(); MC.invalidate('ui'); }
      } else if (drag.type === 'shape') {
        MC.draft.shape = d3.line()(shapePoints(drag.kind, drag.start, p)) + 'Z'; drag.cur = p; MC.invalidate('ui');
      }
      return;
    }
    // hover
    const D = MC.draft;
    if (D && (D.kind === 'line' || D.kind === 'zone') && D.pts.length && !D.free) { D.cur = p; MC.invalidate('ui'); }
    if (D && D.kind === 'measure' && !D.done && D.pts.length) { D.cur = p; updateMeasure(p); MC.invalidate('ui'); }
    const tt = document.getElementById('tooltip');
    const be = e.target.closest && e.target.closest('[data-bn]'), oe = e.target.closest && e.target.closest('[data-oid]');
    let txt = '';
    if (MC.tool === 'select') { if (oe) { const o = MC.getObj(oe.dataset.oid); txt = o ? o.label || o.text || o.name : ''; } else if (be) txt = be.dataset.bn; }
    if (txt) { tt.textContent = txt; tt.style.display = 'block'; const r = document.getElementById('canvasWrap').getBoundingClientRect(); tt.style.left = e.clientX - r.left + 14 + 'px'; tt.style.top = e.clientY - r.top + 14 + 'px'; } else tt.style.display = 'none';
    MC.updateStatus && MC.updateStatus();
  }

  function onUp(e) {
    const p = pt(e);
    ptrs.delete(e.pointerId);
    if (pinch && ptrs.size < 2) { pinch = null; drag = null; return; }
    document.getElementById('page').classList.remove('grabbing');
    if (!drag) return;
    const d = drag; drag = null;
    if (d.type === 'pan') {
      if (!d.moved && MC.tool === 'select') {
        if (d.cand) MC.select(d.cand); else if (MC.sel) MC.select(null);
      }
    } else if (d.type === 'move' || d.type === 'vertex') { if (d.moved) MC.commit(); }
    else if (d.type === 'free') {
      const kind = MC.draft && MC.draft.kind; MC.draft = null;
      const simp = MC.simplifyPx(d.pts, 2.2);
      const geo = simp.map((q) => MC.inv(q)).filter(Boolean);
      if (kind === 'line' && geo.length >= 2) { MC.createLine(MC.drawOpts.line, geo); MC.setTool('select'); }
      else if (kind === 'zone' && geo.length >= 3) { MC.createZone(MC.drawOpts.zone, geo, false); MC.setTool('select'); }
      MC.invalidate('ui');
    } else if (d.type === 'shape') {
      MC.draft = null;
      if (dist(d.start, p) > 6) {
        const geo = shapePoints(d.kind, d.start, p).map((q) => MC.inv(q)).filter(Boolean);
        if (geo.length >= 3) { const z = MC.createZone(MC.drawOpts.zone, geo, false); z.name = d.kind === 'rect' ? 'Persegi' : 'Lingkaran'; MC.setTool('select'); }
      }
      MC.invalidate('ui');
    }
  }

  /* ---------- zoom halus ---------- */
  let wheelF = 1, wheelPos = [0, 0], wheelRaf = 0;
  function wheelStep() {
    wheelRaf = 0;
    const lf = Math.log(wheelF);
    if (Math.abs(lf) < 0.003) { wheelF = 1; return; }
    const s = lf * 0.28;
    MC.zoomAt(Math.exp(s), wheelPos[0], wheelPos[1]);
    wheelF = Math.exp(lf - s);
    wheelRaf = requestAnimationFrame(wheelStep);
  }
  MC.zoomSmooth = function (f, pos) {
    MC.cancelFly && MC.cancelFly();
    wheelPos = pos || [MC.W / 2, MC.H / 2]; wheelF *= f;
    if (!wheelRaf) wheelRaf = requestAnimationFrame(wheelStep);
  };

  function onDbl(e) {
    if (MC.tool !== 'select') return;
    if (e.target.closest('[data-oid]') || e.target.closest('[data-h]')) return;
    const be = e.target.closest('[data-bid]'), p = pt(e);
    if (be && be.dataset.lv === 'country') {
      const a = be.dataset.bid.slice(2), sc = MC.state.scope;
      if (!(sc.type === 'country' && sc.id === a)) { MC.setScope({ type: 'country', id: a }); return; }
    }
    MC.zoomSmooth(2.2, p);
  }

  function onContext(e) {
    e.preventDefault();
    const h = e.target.closest('[data-h]'), o = MC.selObj();
    if (h && o && h.dataset.h[0] === 'v') {
      const min = o.type === 'zone' ? 3 : 2;
      if (o.pts.length > min) { o.pts.splice(+h.dataset.h.slice(1), 1); MC.touch(o); MC.invalidate('objects'); MC.commit(); }
      else MC.toast('Minimal ' + min + ' titik');
    }
  }

  /* ---------- keyboard ---------- */
  const KEYS = { v: 'select', h: 'hand', m: 'marker', r: 'line', z: 'zone', b: 'rect', c: 'circle', t: 'text', u: 'measure' };
  function onKey(e) {
    if (isTyping(e.target)) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.target.closest && e.target.closest('dialog[open]')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? MC.redo() : MC.undo(); return; }
    if (ctrl && k === 'y') { e.preventDefault(); MC.redo(); return; }
    if (ctrl && k === 'd') { e.preventDefault(); MC.duplicateSelected(); return; }
    if (ctrl && k === 's') { e.preventDefault(); MC.saveProject && MC.saveProject(); return; }
    if (ctrl) return;
    if (k === ' ') { space = true; e.preventDefault(); document.getElementById('page').dataset.space = 1; return; }
    if (k === 'escape') {
      if (MC.draft) { cancelDraft(); drag = null; } else if (MC.tour && MC.tour.stop) MC.tour.stop(); else if (MC.tool !== 'select') MC.setTool('select'); else MC.select(null);
      return;
    }
    if (k === 'enter') { finishDraft(); return; }
    if (k === 'backspace' && MC.draft && MC.draft.pts && MC.draft.pts.length) { e.preventDefault(); MC.draft.pts.pop(); if (!MC.draft.pts.length) MC.draft = null; MC.invalidate('ui'); return; }
    if (k === 'delete' || k === 'backspace') { if (MC.sel) { e.preventDefault(); MC.deleteSelected(); } return; }
    if (KEYS[k]) { MC.setTool(KEYS[k]); return; }
    if (k === '+' || k === '=') { MC.zoomSmooth(1.6); return; }
    if (k === '-') { MC.zoomSmooth(1 / 1.6); return; }
    if (k === '0') { MC.resetView(); return; }
    if (k.startsWith('arrow')) {
      const o = MC.selObj(); if (!o) return;
      e.preventDefault();
      const s = e.shiftKey ? 10 : 1;
      shiftObj(o, k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0);
      MC.invalidate('objects'); clearTimeout(MC._nudge); MC._nudge = setTimeout(() => MC.commit(), 400);
    }
  }
  function onKeyUp(e) { if (e.key === ' ') { space = false; delete document.getElementById('page').dataset.space; } }

  MC.initTools = function () {
    const svg = MC.svg;
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('pointerleave', () => { document.getElementById('tooltip').style.display = 'none'; });
    svg.addEventListener('dblclick', onDbl);
    svg.addEventListener('contextmenu', onContext);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); MC.cancelFly && MC.cancelFly(); wheelPos = pt(e); wheelF *= Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)); if (!wheelRaf) wheelRaf = requestAnimationFrame(wheelStep); }, { passive: false });
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    // rotasi otomatis
    let last = performance.now();
    (function loop(now) {
      const dt = Math.min(50, now - last); last = now;
      if (MC.autoRotate && !drag && !MC.cancelFly) { const v = MC.state.view; MC.setView({ lon: v.lon + dt * 0.012, lat: v.lat, k: v.k }, { silent: true }); }
      requestAnimationFrame(loop);
    })(last);
  };
})(window.MC);
