/* UI: toolbar, panel properti, lapisan, peta, layout, pencarian, tur */
(function (MC) {
  const $ = (s, r) => (r || document).querySelector(s);
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
    }
    kids.flat(9).forEach((c) => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }
  MC.h = h;
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#000000');

  /* ---------- kontrol ---------- */
  const C = {
    color(get, set) {
      const i = h('input', { type: 'color', value: hex(get()) });
      i.addEventListener('input', () => set(i.value, false)); i.addEventListener('change', () => set(i.value, true));
      return h('div', { class: 'colorwrap' }, i, h('code', null, hex(get())));
    },
    range(min, max, step, ...rest) {
      let get, set, unit;
      if (typeof rest[0] === 'string') { unit = rest[0]; get = rest[1]; set = rest[2]; } else { get = rest[0]; set = rest[1]; unit = rest[2]; }
      const v = h('span', { class: 'rv' }, (+get()).toFixed(step < 1 ? 1 : 0) + (unit || ''));
      const i = h('input', { type: 'range', min, max, step, value: get() });
      i.addEventListener('input', () => { v.textContent = (+i.value).toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0) + (unit || ''); set(+i.value, false); });
      i.addEventListener('change', () => set(+i.value, true));
      return h('div', { class: 'rangewrap' }, i, v);
    },
    text(get, set, o) {
      o = o || {};
      const i = o.multi ? h('textarea', { rows: 3 }) : h('input', { type: 'text', placeholder: o.ph || '' });
      i.value = get() == null ? '' : get();
      i.addEventListener('input', () => set(i.value, false)); i.addEventListener('change', () => set(i.value, true));
      return i;
    },
    num(get, set, step) {
      const i = h('input', { type: 'number', step: step || 'any' }); i.value = get();
      i.addEventListener('change', () => set(parseFloat(i.value), true)); return i;
    },
    select(opts, get, set) {
      const s = h('select', null, opts.map(([v, l]) => h('option', { value: v }, l)));
      s.value = get(); if (s.value !== String(get())) s.value = opts[0][0];
      s.addEventListener('change', () => set(s.value, true)); return s;
    },
    check(label, get, set) {
      const i = h('input', { type: 'checkbox' }); i.checked = !!get();
      i.addEventListener('change', () => set(i.checked, true));
      return h('label', { class: 'check' }, i, h('span', null, label));
    },
    seg(opts, get, set) {
      const w = h('div', { class: 'seg' });
      opts.forEach(([v, l, t]) => { const b = h('button', { type: 'button', class: String(get()) === String(v) ? 'on' : '', title: t || '', onclick: () => { set(v, true); [...w.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); } }, l); w.append(b); });
      return w;
    }
  };
  const F = (label, ctl, cls) => h('div', { class: 'field ' + (cls || '') }, h('label', null, label), ctl);
  const Sec = (title, ...kids) => h('section', { class: 'sec' }, h('h4', null, title), ...kids);
  const Btn = (label, fn, cls, title) => h('button', { type: 'button', class: 'btn ' + (cls || ''), title: title || '', onclick: fn }, label);

  /* ---------- ikon (Lucide) ---------- */
  const ICONMAP = { select: 'mouse-pointer-2', hand: 'hand', marker: 'map-pin', line: 'route', zone: 'pentagon', rect: 'square', circle: 'circle', text: 'type', measure: 'ruler', undo: 'undo-2', redo: 'redo-2' };
  MC.icon = (n, s) => MC.lucide(ICONMAP[n] || n, s || 20);
  const ic = (n, s) => { const e = document.createElement('span'); e.className = 'ic'; e.innerHTML = MC.lucide(n, s || 16); return e; };
  MC.ic = ic;
  const TOOL_INFO = {
    select: ['Pilih', 'V', 'Pilih, geser objek & ubah bentuk'], hand: ['Geser', 'H', 'Geser peta (atau tahan Spasi)'], marker: ['Kota / Titik', 'M', 'Tambah kota, ibu kota, bandara, dst'],
    line: ['Jalan / Garis', 'R', 'Gambar jalan tol, raya, biasa, sungai, rel, rute'], zone: ['Zona / Area', 'Z', 'Gambar daratan, pemukiman, taman, dll'],
    rect: ['Persegi', 'B', 'Seret untuk membuat area persegi'], circle: ['Lingkaran', 'C', 'Seret dari pusat untuk membuat area lingkaran'],
    text: ['Teks', 'T', 'Tambah teks bebas'], measure: ['Ukur Jarak', 'U', 'Klik beberapa titik untuk mengukur jarak']
  };

  function buildTools() {
    const nav = $('#tools'); nav.innerHTML = '';
    MC.TOOLS.forEach((t) => {
      if (t === 'rect') nav.append(h('div', { class: 'sep' }));
      const b = h('button', { class: 'tool', 'data-tool': t, title: `${TOOL_INFO[t][0]} (${TOOL_INFO[t][1]}) - ${TOOL_INFO[t][2]}`, onclick: () => MC.setTool(t) });
      b.innerHTML = MC.icon(t, 22) + `<span>${TOOL_INFO[t][0]}</span>`;
      nav.append(b);
    });
  }

  /* ---------- opsi alat ---------- */
  function chip(label, active, fn, swatch) { return h('button', { type: 'button', class: 'chip' + (active ? ' on' : ''), onclick: fn }, swatch, label); }
  function buildToolOpts() {
    const bar = $('#toolopts'); bar.innerHTML = '';
    const t = MC.tool, O = MC.drawOpts;
    document.querySelectorAll('#tools .tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    const hint = (s) => h('span', { class: 'hint' }, s);
    if (t === 'select') bar.append(hint('Klik objek/negara untuk memilih · seret objek untuk memindah · seret titik biru untuk ubah bentuk · klik kanan titik = hapus titik · dobel-klik negara = buka peta negara'));
    else if (t === 'hand') bar.append(hint('Seret untuk menggeser peta · scroll / cubit untuk zoom'));
    else if (t === 'marker') {
      bar.append(h('b', null, 'Jenis:'));
      Object.entries(MC.MARKER_TYPES).forEach(([k, v]) => bar.append(chip(v.label, O.marker === k, () => { O.marker = k; buildToolOpts(); }, v.shape === 'icon' ? ic(v.icon, 14) : v.shape === 'glyph' ? h('span', { class: 'gl' }, v.glyph) : h('i', { class: 'dot', style: `background:${v.color}` }))));
      bar.append(hint('Klik di peta untuk menaruh'));
    } else if (t === 'line') {
      bar.append(h('b', null, 'Jenis:'));
      Object.entries(MC.LINE_TYPES).forEach(([k, v]) => bar.append(chip(v.label, O.line === k, () => { O.line = k; buildToolOpts(); }, h('i', { class: 'ln', style: `background:${v.color};box-shadow:0 0 0 1.5px ${v.cw ? v.cc : v.color}` }))));
      bar.append(C.check('Bebas (pensil)', () => O.free, (v) => { O.free = v; }));
      bar.append(hint('Klik tiap titik · dobel-klik / Enter selesai · Backspace undo titik · Esc batal'));
    } else if (t === 'zone' || t === 'rect' || t === 'circle') {
      bar.append(h('b', null, 'Jenis:'));
      Object.entries(MC.ZONE_TYPES).forEach(([k, v]) => bar.append(chip(v.label, O.zone === k, () => { O.zone = k; buildToolOpts(); }, h('i', { class: 'sq', style: `background:${v.fill};border-color:${v.stroke}` }))));
      if (t === 'zone') { bar.append(C.check('Bebas (pensil)', () => O.free, (v) => { O.free = v; })); bar.append(hint('Klik titik-titik · klik titik awal / dobel-klik / Enter untuk menutup')); }
      else bar.append(hint('Seret di peta'));
    } else if (t === 'text') bar.append(hint('Klik di peta untuk menambahkan teks'));
    else if (t === 'measure') bar.append(hint('Klik titik-titik · dobel-klik selesai · jarak mengikuti lengkung bumi'));
  }

  /* ---------- tab ---------- */
  const TABS = [['props', 'Properti'], ['layers', 'Lapisan'], ['map', 'Peta'], ['layout', 'Tata Letak']];
  MC.tab = 'props';
  function buildTabs() {
    const w = $('#tabs'); w.innerHTML = '';
    TABS.forEach(([k, l]) => w.append(h('button', { class: MC.tab === k ? 'on' : '', onclick: () => MC.showTab(k) }, l)));
  }
  MC.showTab = function (k) { MC.tab = k; buildTabs(); renderPanel(); document.getElementById('side').classList.add('open'); };
  function renderPanel() {
    const b = $('#tabbody'), sc = b.scrollTop; b.innerHTML = '';
    ({ props: renderProps, layers: renderLayers, map: renderMapPanel, layout: renderLayoutPanel })[MC.tab](b);
    b.scrollTop = sc;
  }
  MC.renderPanel = renderPanel;

  /* ---------- binding helper ---------- */
  function bind(o, key) {
    return [() => o[key], (v, fin) => { o[key] = v; MC.touch(o); MC.invalidate('objects'); if (fin) { MC.commit(); } }];
  }
  const objField = (o, label, key, ctlFn, ...a) => F(label, ctlFn(...a, ...bind(o, key)));
  function layersRefresh() { if (MC.tab === 'layers') renderPanel(); }

  /* ---------- panel properti ---------- */
  const DASHES = [['', 'Solid'], ['8 6', 'Putus-putus'], ['2 5', 'Titik-titik'], ['10 4 2 4', 'Putus-titik'], ['18 8', 'Putus panjang']];
  const ANIMS = {
    marker: [['none', 'Tanpa animasi'], ['ripple', 'Riak (ripple)'], ['bounce', 'Melompat'], ['pulse', 'Berdenyut'], ['spin', 'Berputar']],
    line: [['none', 'Tanpa animasi'], ['flow', 'Aliran (garis berjalan)'], ['draw', 'Menggambar berulang'], ['glow', 'Bercahaya']],
    zone: [['none', 'Tanpa animasi'], ['breathe', 'Berkedip lembut'], ['glow', 'Bercahaya']],
    text: [['none', 'Tanpa animasi'], ['float', 'Melayang'], ['blink', 'Berkedip']]
  };

  function renderProps(box) {
    const s = MC.sel;
    if (!s) {
      box.append(h('div', { class: 'empty' },
        h('div', { class: 'big' }, ic('mouse-pointer-2', 38)), h('p', null, h('b', null, 'Belum ada yang dipilih')),
        h('p', null, 'Pilih alat di kiri lalu gambar di peta, atau klik objek dan negara dengan alat Pilih.'),
        h('ul', null, h('li', null, 'Atur cakupan peta, tema & warna di tab ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); MC.showTab('map'); } }, 'Peta')),
          h('li', null, 'Judul, legenda, skala & bingkai di tab ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); MC.showTab('layout'); } }, 'Tata Letak')),
          h('li', null, 'Tekan ', h('kbd', null, '?'), ' untuk bantuan & pintasan keyboard'))));
      return;
    }
    if (s.kind === 'base') return renderBaseProps(box, s);
    const o = MC.getObj(s.id); if (!o) return;
    const icon = ic({ marker: 'map-pin', line: 'route', zone: 'pentagon', text: 'type' }[o.type], 20);
    box.append(h('div', { class: 'phead' }, h('span', { class: 'pico' }, icon),
      h('input', { class: 'pname', value: o.name || '', placeholder: 'Nama objek', oninput: (e) => { o.name = e.target.value; layersRefresh(); }, onchange: () => MC.commit() }),
      ));
    box.append(h('div', { class: 'actions' }, Btn([ic('copy'), ' Duplikat'], MC.duplicateSelected), Btn(ic('chevron-up'), () => MC.moveObj(o.id, 1), '', 'Ke depan'), Btn(ic('chevron-down'), () => MC.moveObj(o.id, -1), '', 'Ke belakang'), Btn([ic('trash-2'), ' Hapus'], MC.deleteSelected, 'danger')));
    ({ marker: propsMarker, line: propsLine, zone: propsZone, text: propsText })[o.type](box, o);
    box.append(Sec('Umum',
      objField(o, 'Transparansi', 'opacity', C.range, 0.1, 1, 0.05),
      h('div', { class: 'two' }, objField(o, '', 'visible', C.check.bind(null, 'Terlihat')), objField(o, '', 'locked', C.check.bind(null, 'Kunci'))),
      o.type !== 'text' ? F('Nama di legenda', C.text(...bind(o, 'legend'), { ph: 'Otomatis dari jenis' })) : null,
      o.type !== 'text' ? objField(o, '', 'inLegend', C.check.bind(null, 'Tampilkan di legenda')) : null));
  }

  function presetSelect(o, types, apply) {
    return F('Jenis', C.select(Object.entries(types).map(([k, v]) => [k, v.label || v.name]), () => o.preset, (v) => { apply(o, v); MC.touch(o); MC.invalidate('objects'); MC.commit(); renderPanel(); layersRefresh(); }));
  }
  function propsMarker(box, o) {
    box.append(Sec('Penanda',
      presetSelect(o, MC.MARKER_TYPES, (ob, k) => { const t = MC.MARKER_TYPES[k], prev = (MC.MARKER_TYPES[ob.preset] || {}).name; Object.assign(ob, { preset: k, shape: t.shape, glyph: t.glyph, size: t.size, color: t.color, stroke: t.stroke, lbl: t.lbl, bold: t.bold }); if (!ob.label || ob.label === prev) ob.label = t.name; if (!ob.name || ob.name === prev) ob.name = t.name; }),
      F('Nama / label', (() => { const i = C.text(...bind(o, 'label'), { multi: true }); i.id = 'f-label'; return i; })()),
      F('Posisi label', C.seg([['r', 'Kanan'], ['l', 'Kiri'], ['t', 'Atas'], ['b', 'Bawah']], () => o.lblPos || 'r', (v) => { o.lblPos = v; MC.touch(o); MC.invalidate('objects'); MC.commit(); })),
      h('div', { class: 'two' },
        F('Bujur (lon)', C.num(() => +o.pos[0].toFixed(4), (v) => { if (isFinite(v)) { o.pos[0] = v; MC.touch(o); MC.invalidate('objects'); MC.commit(); } })),
        F('Lintang (lat)', C.num(() => +o.pos[1].toFixed(4), (v) => { if (isFinite(v)) { o.pos[1] = v; MC.touch(o); MC.invalidate('objects'); MC.commit(); } })))));
    box.append(Sec('Tampilan ikon',
      F('Bentuk', C.select([['dot', 'Lingkaran'], ['square', 'Kotak'], ['diamond', 'Berlian'], ['triangle', 'Segitiga'], ['star', 'Bintang'], ['pin', 'Pin'], ['icon', 'Ikon (Lucide)'], ['glyph', 'Emoji']], () => o.shape, (v) => { o.shape = v; MC.touch(o); MC.invalidate('objects'); MC.commit(); renderPanel(); })),
      o.shape === 'icon' ? F('Ikon', h('div', { class: 'glyphs icons' }, MC.ICON_CHOICES.map((n) => h('button', { type: 'button', title: n, class: o.icon === n ? 'on' : '', onclick: () => { o.icon = n; MC.touch(o); MC.invalidate('objects'); MC.commit(); renderPanel(); } }, ic(n, 18))))) : null,
      o.shape === 'glyph' ? F('Emoji / simbol', h('div', null, C.text(...bind(o, 'glyph')), h('div', { class: 'glyphs' }, MC.GLYPHS.map((g) => h('button', { type: 'button', onclick: () => { o.glyph = g; MC.touch(o); MC.invalidate('objects'); MC.commit(); renderPanel(); } }, g))))) : null,
      objField(o, 'Ukuran', 'size', C.range, 5, 60, 1, ' px'),
      o.shape !== 'glyph' ? h('div', { class: 'two' }, objField(o, 'Warna', 'color', C.color), objField(o, 'Garis tepi', 'stroke', C.color)) : null,
      o.shape === 'icon' ? objField(o, 'Warna ikon', 'iconColor', C.color) : null));
    box.append(Sec('Label',
      h('div', { class: 'two' }, objField(o, 'Ukuran', 'lbl', C.range, 8, 40, 1), objField(o, 'Font', 'font', C.select, MC.FONTS.map((f) => [f, f]))),
      h('div', { class: 'two' }, objField(o, 'Warna teks', 'lblColor', C.color), objField(o, 'Warna kontur', 'lblHalo', C.color)),
      objField(o, '', 'bold', C.check.bind(null, 'Tebal'))));
    box.append(Sec('Animasi', objField(o, '', 'anim', C.select, ANIMS.marker)));
  }

  function lineLength(o) { return MC.pathKm(o.pts); }
  function propsLine(box, o) {
    box.append(Sec('Jalan / Garis',
      presetSelect(o, MC.LINE_TYPES, (ob, k) => { const t = MC.LINE_TYPES[k]; Object.assign(ob, { preset: k, w: t.w, color: t.color, cw: t.cw, cc: t.cc, center: t.center || '', centerDash: t.centerDash, centerW: t.centerW, dash: t.dash, smooth: t.smooth, arrow: t.arrow || 'none' }); if (t.anim) ob.anim = t.anim; if (!ob.name || /^[A-Z]/.test(ob.name)) ob.name = t.label; }),
      h('p', { class: 'note' }, `Panjang: ${MC.fmtKm(lineLength(o))} · ${o.pts.length} titik`),
      F('Label di sepanjang jalan', C.text(...bind(o, 'label'), { ph: 'mis. Jl. Sudirman' })),
      h('div', { class: 'two' }, objField(o, 'Ukuran label', 'lbl', C.range, 8, 30, 1), objField(o, 'Warna label', 'lblColor', C.color)),
      objField(o, '', 'smooth', C.check.bind(null, 'Lengkung halus'))));
    box.append(Sec('Garis',
      objField(o, 'Ketebalan', 'w', C.range, 0.5, 20, 0.5, ' px'),
      objField(o, 'Warna', 'color', C.color),
      objField(o, 'Pola', 'dash', C.select, DASHES.concat(DASHES.some((d) => d[0] === (o.dash || '')) ? [] : [[o.dash, 'Kustom']])),
      objField(o, 'Panah', 'arrow', C.select, [['none', 'Tanpa panah'], ['end', 'Di ujung'], ['both', 'Dua ujung']])));
    box.append(Sec('Garis tepi (casing)',
      objField(o, 'Tebal tepi (0 = tanpa)', 'cw', C.range, 0, 30, 0.5, ' px'),
      objField(o, 'Warna tepi', 'cc', C.color),
      C.check('Garis putus-putus di tengah (mis. tol)', () => !!o.center, (v) => { o.center = v ? '#ffffff' : ''; o.centerDash = o.centerDash || '9 7'; o.centerW = o.centerW || 1.3; MC.touch(o); MC.invalidate('objects'); MC.commit(); renderPanel(); }),
      o.center ? objField(o, 'Warna garis tengah', 'center', C.color) : null));
    box.append(Sec('Animasi', objField(o, '', 'anim', C.select, ANIMS.line), h('p', { class: 'note' }, 'Animasi tampil di layar & ekspor SVG. Ekspor PNG/PDF memakai tampilan statis.')));
  }

  function zoneArea(o) {
    const a = d3.geoArea({ type: 'Polygon', coordinates: [o.pts.concat([o.pts[0]])] });
    return Math.min(a, 4 * Math.PI - a) * 6371.0088 * 6371.0088;
  }
  function propsZone(box, o) {
    const ar = zoneArea(o);
    box.append(Sec('Zona / Area',
      presetSelect(o, MC.ZONE_TYPES, (ob, k) => { const t = MC.ZONE_TYPES[k]; Object.assign(ob, { preset: k, fill: t.fill, stroke: t.stroke, sw: t.sw, pattern: t.pattern, pc: t.pc }); if (!ob.name || /^[A-Z]/.test(ob.name)) ob.name = t.label; }),
      h('p', { class: 'note' }, `Luas ≈ ${ar < 1 ? (ar * 1e6).toFixed(0) + ' m²' : ar < 100 ? ar.toFixed(2) + ' km²' : Math.round(ar).toLocaleString('id-ID') + ' km²'} · ${o.pts.length} titik`),
      F('Label', C.text(...bind(o, 'label'), { ph: 'mis. Kawasan Industri' })),
      h('div', { class: 'two' }, objField(o, 'Ukuran label', 'lbl', C.range, 8, 40, 1), objField(o, 'Warna label', 'lblColor', C.color)),
      objField(o, '', 'smooth', C.check.bind(null, 'Sudut melengkung halus'))));
    box.append(Sec('Isi & garis tepi',
      h('div', { class: 'two' }, objField(o, 'Warna isi', 'fill', C.color), objField(o, 'Warna tepi', 'stroke', C.color)),
      objField(o, 'Opasitas isi', 'fillOp', C.range, 0, 1, 0.05),
      objField(o, 'Tebal tepi', 'sw', C.range, 0, 12, 0.5, ' px'),
      objField(o, 'Pola tepi', 'dash', C.select, DASHES),
      F('Pola isi', C.select([['none', 'Polos'], ['hatch', 'Arsir miring'], ['cross', 'Arsir silang'], ['dots', 'Titik-titik'], ['lines', 'Garis'], ['waves', 'Gelombang']], () => o.pattern || 'none', (v) => { o.pattern = v; MC.touch(o); MC.invalidate('objects'); MC.commit(); renderPanel(); })),
      o.pattern && o.pattern !== 'none' ? objField(o, 'Warna pola', 'pc', C.color) : null));
    box.append(Sec('Animasi', objField(o, '', 'anim', C.select, ANIMS.zone)));
  }

  function propsText(box, o) {
    box.append(Sec('Teks',
      F('Isi teks', (() => { const i = C.text(...bind(o, 'text'), { multi: true }); i.id = 'f-text'; return i; })()),
      h('div', { class: 'two' }, objField(o, 'Ukuran', 'size', C.range, 8, 120, 1), objField(o, 'Rotasi', 'rot', C.range, -180, 180, 1, '°')),
      h('div', { class: 'two' }, objField(o, 'Warna', 'color', C.color), objField(o, 'Font', 'font', C.select, MC.FONTS.map((f) => [f, f]))),
      objField(o, 'Perataan', 'align', C.seg, [['l', 'Kiri'], ['c', 'Tengah'], ['r', 'Kanan']]),
      objField(o, 'Jarak huruf', 'spacing', C.range, 0, 20, 0.5),
      h('div', { class: 'two' }, objField(o, '', 'bold', C.check.bind(null, 'Tebal')), objField(o, '', 'italic', C.check.bind(null, 'Miring'))),
      h('div', { class: 'two' }, objField(o, '', 'halo', C.check.bind(null, 'Kontur')), o.halo !== false ? objField(o, 'Warna kontur', 'haloColor', C.color) : null)));
    box.append(Sec('Animasi', objField(o, '', 'anim', C.select, ANIMS.text)));
  }

  function renderBaseProps(box, s) {
    const ov = (MC.state.overrides[s.id] = MC.state.overrides[s.id] || {});
    const set = (k) => [() => ov[k] || '#cccccc', (v, fin) => { ov[k] = v; MC.invalidate('base'); if (fin) MC.commit(); }];
    const S = MC.state.style;
    box.append(h('div', { class: 'phead' }, h('span', { class: 'pico' }, ic(s.level === 'admin' ? 'map' : 'globe', 20)), h('b', { class: 'pname-static' }, s.name), h('span', { class: 'tag' }, s.level === 'admin' ? 'Provinsi / wilayah' : 'Negara')));
    const sec = Sec('Wilayah dasar',
      F('Warna isi', h('div', { class: 'inline' }, C.color(...set('fill')), Btn('Reset', () => { delete ov.fill; MC.invalidate('base'); MC.commit(); renderPanel(); }, 'small'))),
      F('Warna tepi', h('div', { class: 'inline' }, C.color(...set('stroke')), Btn('Reset', () => { delete ov.stroke; MC.invalidate('base'); MC.commit(); renderPanel(); }, 'small'))),
      F('Nama kustom', C.text(() => ov.label || s.name, (v, fin) => { ov.label = v; MC.invalidate('base'); if (fin) MC.commit(); })),
      C.check('Sembunyikan nama', () => ov.hideLabel, (v) => { ov.hideLabel = v; MC.invalidate('base'); MC.commit(); }));
    box.append(sec);
    const acts = h('div', { class: 'actions' });
    if (s.level === 'country') acts.append(Btn([ic('search'), ' Buka peta negara ini'], () => MC.setScope({ type: 'country', id: s.id.slice(2) }), 'primary'));
    acts.append(Btn('Hapus pengaturan', () => { delete MC.state.overrides[s.id]; MC.invalidate('base'); MC.commit(); renderPanel(); }));
    box.append(acts);
  }

  /* ---------- lapisan ---------- */
  function renderLayers(box) {
    const objs = MC.state.objects;
    box.append(h('p', { class: 'note' }, objs.length ? 'Urutan atas = paling depan. Klik untuk memilih.' : 'Belum ada objek. Gunakan alat di kiri untuk menambahkan kota, jalan, zona, atau teks.'));
    const list = h('div', { class: 'layers' });
    [...objs].reverse().forEach((o) => {
      const sel = MC.sel && MC.sel.id === o.id;
      const sw = o.type === 'zone' ? h('i', { class: 'sq', style: `background:${o.fill};border-color:${o.stroke}` }) : o.type === 'line' ? h('i', { class: 'ln', style: `background:${o.color}` }) : o.type === 'marker' ? (o.shape === 'glyph' ? h('span', { class: 'gl' }, o.glyph) : o.shape === 'icon' ? ic(o.icon, 15) : h('i', { class: 'dot', style: `background:${o.color}` })) : h('b', null, 'T');
      list.append(h('div', { class: 'layer' + (sel ? ' on' : '') + (o.visible === false ? ' off' : ''), onclick: () => { MC.select({ kind: 'obj', id: o.id }); MC.showTab('props'); } },
        sw, h('span', { class: 'lname' }, o.name || o.label || o.text || o.type),
        h('button', { title: 'Tampil/sembunyi', onclick: (e) => { e.stopPropagation(); o.visible = o.visible === false; MC.touch(o); MC.invalidate('objects'); MC.commit(); renderPanel(); } }, ic(o.visible === false ? 'eye-off' : 'eye', 14)),
        h('button', { title: 'Kunci', onclick: (e) => { e.stopPropagation(); o.locked = !o.locked; MC.commit(); renderPanel(); } }, ic(o.locked ? 'lock' : 'lock-open', 14)),
        h('button', { title: 'Ke depan', onclick: (e) => { e.stopPropagation(); MC.moveObj(o.id, 1); } }, ic('chevron-up', 14)),
        h('button', { title: 'Ke belakang', onclick: (e) => { e.stopPropagation(); MC.moveObj(o.id, -1); } }, ic('chevron-down', 14)),
        h('button', { title: 'Zoom ke objek', onclick: (e) => { e.stopPropagation(); focusObj(o); } }, ic('crosshair', 14)),
        h('button', { title: 'Hapus', onclick: (e) => { e.stopPropagation(); MC.deleteObj(o.id); } }, ic('x', 14))));
    });
    box.append(list);
    if (objs.length) box.append(h('div', { class: 'actions' }, Btn('Hapus semua objek', () => { if (confirm('Hapus semua objek buatan?')) { MC.state.objects = []; MC.sel = null; MC.invalidate('all'); MC.commit(); MC.emit('selection'); } }, 'danger small')));
  }
  function focusObj(o) {
    const pts = o.pts || [o.pos];
    if (pts.length === 1) return MC.flyTo({ lon: pts[0][0], lat: pts[0][1], k: Math.max(MC.state.view.k, 1200) });
    const key = MC.state.projection; const v = MC.fitPoints(pts, key, 120);
    MC.flyTo(v);
  }
  MC.on('layers', () => layersRefresh());

  /* ---------- panel peta ---------- */
  function renderMapPanel(box) {
    const st = MC.state, S = st.style;
    const scopeVal = st.scope.type === 'world' ? 'world' : st.scope.type === 'blank' ? 'blank' : st.scope.type === 'continent' ? 'k:' + st.scope.id : 'c:' + st.scope.id;
    const opts = [h('option', { value: 'world' }, 'Peta Dunia'), h('option', { value: 'blank' }, 'Kanvas Kosong (buat bentuk sendiri)'),
      h('optgroup', { label: 'Benua' }, Object.keys(MC.SCOPE_BOXES).map((k) => h('option', { value: 'k:' + k }, MC.CONTINENT_LABELS[k]))),
      h('optgroup', { label: 'Negara' }, MC.countryList.map((c) => h('option', { value: 'c:' + c.a }, c.n)))];
    const sel = h('select', { onchange: () => {
      const v = sel.value;
      MC.setScope(v === 'world' ? { type: 'world' } : v === 'blank' ? { type: 'blank' } : v[0] === 'k' ? { type: 'continent', id: v.slice(2) } : { type: 'country', id: v.slice(2) });
    } }, opts);
    sel.value = scopeVal;
    const R = st.real;
    const realKids = [C.check('Aktifkan Real Data (OpenStreetMap)', () => R.on, (v) => { R.on = v; MC.invalidate('all'); MC.commit(); renderPanel(); if (v) MC.fetchReal(true); })];
    if (R.on) {
      const rc = (k, l) => C.check(l, () => R[k], (v) => { R[k] = v; MC.commit(); MC.fetchReal(true); });
      realKids.push(h('div', { class: 'two' }, rc('roads', 'Jalan'), rc('buildings', 'Bangunan')), h('div', { class: 'two' }, rc('landuse', 'Zona / lahan'), rc('water', 'Air')), rc('rail', 'Rel kereta'),
        h('p', { class: 'note' + (MC.real.loading ? ' busy' : '') }, MC.real.msg || 'Tidak ada batas area. Area yang luas atau padat butuh waktu lebih lama dan membuat peta lebih berat.'),
        h('div', { class: 'actions' }, Btn([ic('refresh-cw'), ' Ambil data area ini'], () => MC.fetchReal(true), 'primary'), Btn([ic('layers'), ' Jadikan objek'], MC.importReal, '', 'Salin data di layar ke lapisan supaya bisa diedit'), Btn([ic('trash-2'), ' Hapus'], MC.clearReal, 'danger small')));
    } else realKids.push(h('p', { class: 'note' }, 'Ambil jalan, bangunan, dan zona asli di area yang tampil. Data berasal dari OpenStreetMap dan butuh koneksi internet.'));
    box.append(Sec('Data nyata', ...realKids));
    box.append(Sec('Cakupan peta',
      F('Tampilkan', sel),
      C.check('Hanya tampilkan wilayah terpilih', () => st.isolate, (v) => { st.isolate = v; MC.invalidate('all'); MC.commit(); }),
      C.check('Batas provinsi / wilayah administrasi', () => st.admin1, (v) => { st.admin1 = v; if (v) MC.loadAdmin1(); MC.invalidate('all'); MC.commit(); }),
      h('div', { class: 'actions' }, Btn([ic('house'), ' Reset tampilan'], MC.resetView), Btn([ic('locate-fixed'), ' Pusatkan cakupan'], () => MC.flyTo(MC.fitScope(st.scope))))));
    box.append(Sec('Proyeksi',
      F('Jenis proyeksi', C.select(Object.entries(MC.PROJ).map(([k, v]) => [k, v.label]), () => st.projection, (v) => MC.setProjection(v, true))),
      C.check('Pilih proyeksi otomatis sesuai cakupan', () => st.autoProj, (v) => { st.autoProj = v; if (v) MC.resetView(); MC.commit(); }),
      C.check('Putar otomatis (animasi globe)', () => MC.autoRotate, (v) => { MC.autoRotate = v; if (v && st.projection !== 'orthographic') MC.setProjection('orthographic', true); })));
    const tg = h('div', { class: 'themes' });
    Object.entries(MC.THEMES).forEach(([k, t]) => tg.append(h('button', { class: 'theme' + (st.theme === k ? ' on' : ''), onclick: () => { MC.applyTheme(k); renderPanel(); } },
      h('span', { class: 'tsw', style: `background:linear-gradient(135deg,${t.style.ocean} 50%,${t.style.land} 50%)` }), t.label)));
    box.append(Sec('Tema', tg));
    const sb = (key) => [() => S[key], (v, fin) => { S[key] = v; MC.invalidate('style'); MC.invalidate('base'); if (fin) MC.commit(); }];
    box.append(Sec('Warna & garis',
      h('div', { class: 'two' }, F('Laut', C.color(...sb('ocean'))), F('Daratan', C.color(...sb('land')))),
      h('div', { class: 'two' }, F('Negara lain (redup)', C.color(...sb('dim'))), F('Latar halaman', C.color(...sb('pageBg')))),
      h('div', { class: 'two' }, F('Batas negara', C.color(...sb('border'))), F('Batas provinsi', C.color(...sb('adminBorder')))),
      F('Tebal batas negara', C.range(0, 4, 0.1, ...sb('bw'))),
      F('Tebal batas provinsi', C.range(0, 3, 0.1, ...sb('aw'))),
      C.check('Warna-warni (peta politik)', () => S.colorize, (v) => { S.colorize = v; MC.invalidate('all'); MC.commit(); }),
      C.check('Bayangan daratan', () => S.shadow, (v) => { S.shadow = v; MC.invalidate('all'); MC.commit(); }),
      C.check('Garis lintang-bujur (graticule)', () => S.graticule, (v) => { S.graticule = v; MC.invalidate('all'); MC.commit(); }),
      C.check('Danau besar', () => S.lakes, (v) => { S.lakes = v; MC.invalidate('all'); MC.commit(); })));
    box.append(Sec('Label bawaan',
      C.check('Nama negara', () => S.countryLabels, (v) => { S.countryLabels = v; MC.invalidate('base'); MC.commit(); }),
      C.check('Nama provinsi', () => S.adminLabels, (v) => { S.adminLabels = v; MC.invalidate('base'); MC.commit(); }),
      C.check('Kota otomatis (muncul sesuai zoom)', () => S.cities, (v) => { S.cities = v; MC.invalidate('all'); MC.commit(); }),
      F('Font', C.select(MC.FONTS.map((f) => [f, f]), () => S.font, (v) => { S.font = v; MC.invalidate('base'); MC.invalidate('cities'); MC.commit(); })),
      F('Ukuran label', C.range(0.6, 2, 0.05, ...sb('labelSize'))),
      h('div', { class: 'two' }, F('Warna teks', C.color(...sb('text'))), F('Kontur teks', C.color(...sb('halo'))))));
  }
  MC.applyTheme = function (k) {
    const st = MC.state; st.theme = k; Object.assign(st.style, MC.THEMES[k].style);
    MC.invalidate('all'); MC.commit();
  };

  /* ---------- panel layout ---------- */
  function renderLayoutPanel(box) {
    const L = MC.state.layout;
    const lb = (grp, key) => [() => L[grp][key], (v, fin) => { L[grp][key] = v; MC.invalidate('layout'); MC.invalidate('base'); if (fin) MC.commit(); }];
    const corner = (grp) => C.seg([['tl', ic('arrow-up-left', 16)], ['tr', ic('arrow-up-right', 16)], ['bl', ic('arrow-down-left', 16)], ['br', ic('arrow-down-right', 16)]], () => L[grp].pos, (v) => { L[grp].pos = v; MC.invalidate('layout'); MC.commit(); });
    box.append(Sec('Ukuran kanvas',
      F('Rasio halaman', C.select([[0, 'Otomatis (penuh)'], [1.4142, 'A4 / A3 Landscape'], [0.7071, 'A4 / A3 Portrait'], [1.7778, '16:9 (layar)'], [1.3333, '4:3'], [1, '1:1 (kotak)'], [0.5625, '9:16 (story)'], [2, '2:1 (banner)']], () => String(L.aspect), (v) => { L.aspect = +v; MC.layoutPage(); MC.commit(); }))));
    box.append(Sec('Judul',
      C.check('Tampilkan judul', () => L.title.show, (v) => { L.title.show = v; MC.invalidate('layout'); MC.commit(); }),
      F('Judul', C.text(...lb('title', 'text'))), F('Subjudul', C.text(...lb('title', 'sub'))),
      h('div', { class: 'two' }, F('Ukuran', C.range(14, 80, 1, ...lb('title', 'size'))), F('Warna', C.color(...lb('title', 'color')))),
      h('div', { class: 'two' }, F('Font', C.select(MC.FONTS.map((f) => [f, f]), ...lb('title', 'font'))), F('Posisi', C.select([['top', 'Atas'], ['bottom', 'Bawah']], ...lb('title', 'pos')))),
      F('Perataan', C.seg([['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']], () => L.title.align, (v) => { L.title.align = v; MC.invalidate('layout'); MC.commit(); })),
      C.check('Kotak latar judul', () => L.title.bg, (v) => { L.title.bg = v; MC.invalidate('layout'); MC.commit(); })));
    box.append(Sec('Legenda', C.check('Tampilkan legenda (otomatis dari objek)', () => L.legend.show, (v) => { L.legend.show = v; MC.invalidate('layout'); MC.commit(); }), F('Judul legenda', C.text(...lb('legend', 'title'))), F('Pojok', corner('legend'))));
    box.append(Sec('Skala & kompas',
      C.check('Skala jarak', () => L.scalebar.show, (v) => { L.scalebar.show = v; MC.invalidate('layout'); MC.commit(); }), F('Pojok skala', corner('scalebar')),
      C.check('Kompas / arah utara', () => L.compass.show, (v) => { L.compass.show = v; MC.invalidate('layout'); MC.commit(); }), F('Pojok kompas', corner('compass'))));
    box.append(Sec('Bingkai',
      C.check('Bingkai peta', () => L.frame.show, (v) => { L.frame.show = v; MC.invalidate('layout'); MC.commit(); }),
      F('Gaya', C.seg([['single', 'Tunggal'], ['double', 'Ganda']], () => L.frame.style, (v) => { L.frame.style = v; MC.invalidate('layout'); MC.commit(); })),
      h('div', { class: 'two' }, F('Tebal', C.range(1, 20, 1, ...lb('frame', 'width'))), F('Warna', C.color(...lb('frame', 'color'))))));
  }

  /* ---------- status ---------- */
  MC.updateStatus = function () {
    const p = MC.lastPointer, c = p && MC.proj && MC.inv(p);
    $('#stCoord').textContent = c ? `${Math.abs(c[1]).toFixed(4)}° ${c[1] >= 0 ? 'U' : 'S'}, ${Math.abs(c[0]).toFixed(4)}° ${c[0] >= 0 ? 'T' : 'B'}` : '-';
    const z = MC.state.view.k / (MC.W / 5.6);
    $('#stZoom').textContent = `Zoom ${z < 10 ? z.toFixed(1) : Math.round(z)}×`;
  };

  /* ---------- pencarian ---------- */
  function initSearch() {
    const inp = $('#search'), res = $('#results');
    let items = [];
    const draw = () => {
      res.innerHTML = '';
      if (!items.length) { res.style.display = 'none'; return; }
      res.style.display = 'block';
      items.forEach((it) => {
        const row = h('div', { class: 'res', onmousedown: (e) => { e.preventDefault(); pick(it); } }, h('span', { class: 'rt' }, ic(it.icon, 16)), h('span', { class: 'rn' }, it.label, h('small', null, it.sub)));
        if (it.type === 'city') row.append(h('button', { class: 'mini', title: 'Tambahkan sebagai penanda', onmousedown: (e) => { e.preventDefault(); e.stopPropagation(); addCity(it); } }, ic('plus', 14)));
        res.append(row);
      });
    };
    function addCity(it) {
      const pos = it.c.ll.slice(); const o = MC.createMarker(it.c.cap ? 'capital' : 'city', pos); o.label = it.c.n; o.name = it.c.n; MC.touch(o); MC.invalidate('objects'); MC.commit(); MC.emit('selection');
      MC.flyTo({ lon: pos[0], lat: pos[1], k: Math.max(MC.state.view.k, 900) }); res.style.display = 'none'; inp.value = '';
    }
    async function pick(it) {
      res.style.display = 'none'; inp.value = '';
      if (it.type === 'country') MC.setScope({ type: 'country', id: it.a });
      else if (it.type === 'city') MC.flyTo({ lon: it.c.ll[0], lat: it.c.ll[1], k: Math.max(MC.state.view.k, 1500) });
      else if (it.type === 'admin') {
        const a = it.f.properties.a, sc = MC.state.scope;
        if (!(sc.type === 'country' && sc.id === a)) await MC.setScope({ type: 'country', id: a }, true);
        MC.select({ kind: 'base', id: it.f.key, name: it.f.name, level: 'admin' }); MC.showTab('props');
      }
    }
    const run = () => {
      const q = inp.value.trim().toLowerCase(); items = [];
      if (q.length < 2) return draw();
      if (!MC.admin1 && !MC._a1p) MC.loadAdmin1().then(run);
      const sc = (s) => (s.toLowerCase().startsWith(q) ? 0 : 1);
      const out = [];
      MC.countries.forEach((f) => { if (f.name.toLowerCase().includes(q)) out.push({ w: sc(f.name), type: 'country', icon: 'globe', label: f.name, sub: ' · Negara', a: f.properties.a }); });
      (MC.admin1 || []).forEach((f) => { if (f.name && f.name.toLowerCase().includes(q)) out.push({ w: sc(f.name) + 0.5, type: 'admin', icon: 'map', label: f.name, sub: ' · ' + ((MC.byA.get(f.properties.a) || {}).name || ''), f }); });
      MC.cities.forEach((c) => { if (c.n.toLowerCase().includes(q)) out.push({ w: sc(c.n) + 0.2, type: 'city', icon: c.cap ? 'star' : 'map-pin', label: c.n, sub: ' · Kota · ' + ((MC.byA.get(c.a) || {}).name || ''), c }); });
      out.sort((a, b) => a.w - b.w);
      items = out.slice(0, 10); draw();
    };
    inp.addEventListener('input', run);
    inp.addEventListener('focus', run);
    inp.addEventListener('blur', () => setTimeout(() => (res.style.display = 'none'), 150));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && items[0]) pick(items[0]); if (e.key === 'Escape') { inp.blur(); } });
  }

  /* ---------- tur ---------- */
  MC.tour = null;
  MC.startTour = async function () {
    if (MC.tour) { MC.tour.stop(); return; }
    const marks = MC.state.objects.filter((o) => o.type === 'marker' && o.visible !== false);
    if (!marks.length) { MC.toast('Tambahkan beberapa penanda dulu untuk membuat tur'); return; }
    const saved = Object.assign({}, MC.state.view), cap = $('#caption'); let stop = false;
    MC.tour = { stop: () => { stop = true; MC.cancelFly && MC.cancelFly(); } };
    $('#btnTour').innerHTML = MC.lucide('square', 14) + ' Hentikan';
    MC.hideUI = true; MC.invalidate('ui');
    const k = Math.min(Math.max(saved.k * 2.2, 500), 4e5);
    for (const m of marks) {
      if (stop) break;
      cap.classList.remove('show');
      const ok = await MC.flyTo({ lon: m.pos[0], lat: m.pos[1], k });
      if (!ok || stop) break;
      cap.innerHTML = ''; cap.append(h('b', null, m.label || m.name), h('small', null, (MC.MARKER_TYPES[m.preset] || {}).label || ''));
      cap.classList.add('show');
      await new Promise((r) => setTimeout(r, 1900));
    }
    cap.classList.remove('show'); MC.hideUI = false; MC.tour = null; $('#btnTour').innerHTML = MC.lucide('play', 14) + ' Tur';
    MC.invalidate('ui'); MC.flyTo(saved);
  };

  /* ---------- contoh peta ---------- */
  MC.loadDemo = async function () {
    MC.state.objects = []; MC.sel = null;
    MC.state.layout.title.text = 'Pulau Jawa: Contoh Peta'; MC.state.layout.title.sub = 'Kota, jalan tol, zona, dan rute beranimasi';
    await MC.setScope({ type: 'country', id: 'IDN' }, false);
    MC.setView({ lon: 110.2, lat: -7.3, k: MC.W * 3.6 });
    const z = (preset, pts, label) => { const o = MC.createZone(preset, pts, true); o.label = label || ''; o.lbl = 13; MC.touch(o); return o; };
    z('residential', [[106.68, -6.1], [107.0, -6.12], [107.05, -6.35], [106.8, -6.45], [106.62, -6.3]], 'Jabodetabek');
    z('industrial', [[107.35, -6.2], [107.6, -6.2], [107.62, -6.4], [107.38, -6.42]], 'Kws. Industri').pattern = 'hatch';
    z('park', [[110.1, -7.45], [110.3, -7.4], [110.45, -7.55], [110.2, -7.65]], 'Hutan Kota');
    z('farm', [[109.0, -7.0], [109.45, -6.95], [109.5, -7.2], [109.1, -7.25]], 'Sawah');
    const L = (preset, pts, label, extra) => { const o = MC.createLine(preset, pts); o.label = label || ''; Object.assign(o, extra || {}); MC.touch(o); return o; };
    L('toll', [[106.82, -6.2], [107.45, -6.35], [108.55, -6.7], [109.65, -6.9], [110.42, -6.98], [111.5, -7.35], [112.75, -7.28]], 'Tol Trans-Jawa');
    L('highway', [[107.6, -6.9], [108.2, -7.3], [109.0, -7.45], [110.0, -7.6], [110.37, -7.8]], 'Jalan Raya Selatan');
    L('rail', [[106.82, -6.2], [107.6, -6.92], [108.55, -7.05], [110.37, -7.8], [112.75, -7.28]], 'KA Jawa', {});
    L('river', [[110.9, -7.55], [111.4, -7.2], [112.2, -6.95], [112.75, -6.9]], 'Bengawan Solo');
    L('route', [[106.82, -6.2], [110.37, -7.8], [112.75, -7.28]], '', { anim: 'flow' });
    const M = (preset, pos, label, extra) => { const o = MC.createMarker(preset, pos); o.label = label; Object.assign(o, extra || {}); MC.touch(o); return o; };
    M('capital', [106.85, -6.2], 'Jakarta', { anim: 'ripple' });
    M('metropolis', [107.61, -6.92], 'Bandung'); M('city', [110.42, -6.97], 'Semarang');
    M('city', [110.37, -7.8], 'Yogyakarta', { lblPos: 'b' }); M('metropolis', [112.75, -7.25], 'Surabaya', { anim: 'pulse' });
    M('airport', [106.66, -6.13], 'Soekarno-Hatta', { lblPos: 'l' }); M('mountain', [110.44, -7.54], 'G. Merapi', { lblPos: 't' }); M('port', [106.88, -6.1], 'Tj. Priok', { lblPos: 't' });
    const t = MC.createText([108.0, -8.3]); t.text = 'Samudra Hindia'; t.italic = true; t.size = 20; t.color = '#3b6fa0'; t.rot = -6; t.spacing = 3; t.haloColor = '#bfe3f7'; MC.touch(t);
    MC.sel = null; MC.invalidate('all'); MC.resetHistory(); MC.emit('restore');
  };

  /* ---------- init UI ---------- */
  MC.initUI = function () {
    document.querySelectorAll('[data-ic]').forEach((e) => { e.insertAdjacentHTML('afterbegin', MC.lucide(e.dataset.ic, +e.dataset.s || 16)); });
    buildTools(); buildToolOpts(); buildTabs(); renderPanel(); initSearch();
    MC.on('tool', buildToolOpts);
    MC.on('selection', (opts) => {
      if (MC.sel) { MC.tab = 'props'; buildTabs(); }
      renderPanel();
      if (opts && opts.focusField) setTimeout(() => { const f = document.getElementById('f-' + opts.focusField); if (f) { f.focus(); f.select && f.select(); } }, 80);
      MC.invalidate('ui');
    });
    MC.on('restore', () => { buildTabs(); renderPanel(); });
    MC.on('real', () => { if (MC.tab === 'map') renderPanel(); });
    MC.on('scope', () => { if (MC.tab === 'map') renderPanel(); });
    MC.on('admin1', () => { if (MC.tab === 'map') renderPanel(); });
    MC.on('history', () => { $('#btnUndo').disabled = !MC.canUndo(); $('#btnRedo').disabled = !MC.canRedo(); });
    $('#btnUndo').innerHTML = MC.icon('undo', 18); $('#btnRedo').innerHTML = MC.icon('redo', 18);
    $('#btnUndo').onclick = MC.undo; $('#btnRedo').onclick = MC.redo;
    $('#btnTour').onclick = MC.startTour;
    $('#zIn').onclick = () => MC.zoomSmooth(1.7); $('#zOut').onclick = () => MC.zoomSmooth(1 / 1.7); $('#zHome').onclick = MC.resetView;
    $('#btnPanel').onclick = () => $('#side').classList.toggle('open');
  };
})(window.MC);
