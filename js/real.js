/* Real Data: jalan, bangunan, zona asli dari OpenStreetMap (Overpass API) */
(function (MC) {
  const clamp = MC.clamp;
  MC.REAL_DEFAULT = { on: false, roads: true, buildings: true, landuse: true, water: true, rail: true };
  MC.real = { items: [], ids: new Set(), covered: [], loading: false, msg: '' };
  const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  const MAJOR = 'motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link';

  MC.viewBBox = function () {
    const pts = [[0, 0], [MC.W, 0], [MC.W, MC.H], [0, MC.H], [MC.W / 2, MC.H / 2]].map((p) => MC.proj.invert(p));
    if (pts.some((p) => !p || !isFinite(p[0]) || !isFinite(p[1]))) return null;
    const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    const w = Math.min(...lons), e = Math.max(...lons);
    if (e - w > 180) return null;
    return { s: Math.min(...lats), w, n: Math.max(...lats), e };
  };
  const spanOf = (b) => Math.max(b.e - b.w, b.n - b.s);
  const tierOf = (span) => (span > 0.12 ? 0 : span > 0.04 ? 1 : 2);

  function classify(t) {
    if (t.building) return { kind: 'area', type: 'building' };
    const hw = t.highway;
    if (hw) {
      if (/^(motorway|motorway_link)$/.test(hw)) return { kind: 'line', type: 'toll', cls: 0 };
      if (/^(trunk|trunk_link|primary|primary_link)$/.test(hw)) return { kind: 'line', type: 'highway', cls: 1 };
      if (/^(secondary|secondary_link|tertiary|tertiary_link)$/.test(hw)) return { kind: 'line', type: 'street', cls: 2 };
      if (/^(residential|unclassified|living_street|service|road)$/.test(hw)) return { kind: 'line', type: 'lane', cls: 3 };
      if (/^(footway|path|cycleway|track|steps|pedestrian|bridleway)$/.test(hw)) return { kind: 'line', type: 'path', cls: 4 };
      return null;
    }
    if (t.railway && /^(rail|light_rail|subway|tram|narrow_gauge|monorail)$/.test(t.railway)) return { kind: 'line', type: 'rail', cls: 5 };
    if (t.waterway && /^(river|stream|canal|drain)$/.test(t.waterway)) return { kind: 'line', type: 'river', cls: 6 };
    if (t.aeroway === 'aerodrome') return { kind: 'area', type: 'airport' };
    const lu = t.landuse, nat = t.natural, le = t.leisure, am = t.amenity;
    if (lu === 'residential') return { kind: 'area', type: 'residential' };
    if (lu === 'commercial' || lu === 'retail') return { kind: 'area', type: 'commercial' };
    if (lu === 'industrial') return { kind: 'area', type: 'industrial' };
    if (/^(farmland|farmyard|orchard|vineyard|meadow|paddy|plant_nursery)$/.test(lu)) return { kind: 'area', type: 'farm' };
    if (lu === 'forest' || nat === 'wood') return { kind: 'area', type: 'forest' };
    if (/^(grass|recreation_ground|cemetery|village_green|greenfield)$/.test(lu) || /^(park|garden|pitch|playground|golf_course|nature_reserve)$/.test(le) || nat === 'grassland' || nat === 'scrub') return { kind: 'area', type: 'park' };
    if (nat === 'water' || nat === 'wetland' || lu === 'reservoir' || lu === 'basin') return { kind: 'area', type: 'water' };
    if (nat === 'beach' || nat === 'sand') return { kind: 'area', type: 'desert' };
    if (/^(school|university|college|hospital)$/.test(am)) return { kind: 'area', type: 'public' };
    return null;
  }

  function buildQuery(b, cats, span) {
    const parts = [];
    if (cats.roads) parts.push(span > 0.12 ? `way["highway"~"^(${MAJOR})$"];` : span > 0.04 ? 'way["highway"]["highway"!~"^(footway|path|cycleway|steps|track|service|pedestrian|bridleway|proposed|construction)$"];' : 'way["highway"]["highway"!~"^(proposed|construction)$"];');
    if (cats.rail) parts.push('way["railway"~"^(rail|light_rail|subway|tram|narrow_gauge|monorail)$"];');
    if (cats.water) parts.push(span > 0.12 ? 'way["waterway"~"^(river|canal)$"];way["natural"="water"];' : 'way["waterway"~"^(river|stream|canal|drain)$"];way["natural"~"^(water|wetland|beach)$"];way["landuse"~"^(reservoir|basin)$"];');
    if (cats.landuse) parts.push('way["landuse"~"^(residential|commercial|retail|industrial|farmland|farmyard|orchard|vineyard|meadow|forest|grass|recreation_ground|cemetery)$"];way["natural"="wood"];way["leisure"~"^(park|garden|pitch|golf_course|nature_reserve)$"];way["aeroway"="aerodrome"];');
    if (cats.buildings && span <= 0.04) parts.push('way["building"];');
    if (!parts.length) return null;
    return `[out:json][timeout:40][bbox:${b.s.toFixed(5)},${b.w.toFixed(5)},${b.n.toFixed(5)},${b.e.toFixed(5)}];(${parts.join('')});out geom tags 9000;`;
  }

  async function postOverpass(q) {
    let last;
    for (const url of MIRRORS) {
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 45000);
        const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
        clearTimeout(to);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) { last = e; }
    }
    throw last || new Error('Server tidak menjawab');
  }

  function setMsg(m, loading) { MC.real.msg = m; MC.real.loading = !!loading; MC.emit('real'); }

  MC.fetchReal = async function (manual) {
    const st = MC.state, R = MC.real;
    if (!st.real.on || R.loading) return;
    const b = MC.viewBBox();
    if (!b) { if (manual) setMsg('Area tidak valid di proyeksi ini. Pilih proyeksi datar atau Mercator.'); return; }
    const span = spanOf(b);
    if (span > 0.35) { setMsg(`Area terlalu luas (${span.toFixed(2)}°). Perbesar peta sampai kurang dari ± 35 km.`); return; }
    const tier = tierOf(span), cats = { roads: st.real.roads, buildings: st.real.buildings, landuse: st.real.landuse, water: st.real.water, rail: st.real.rail };
    const ckey = JSON.stringify(cats);
    if (!manual && R.covered.some((c) => c.ckey === ckey && c.tier >= tier && c.b.s <= b.s && c.b.w <= b.w && c.b.n >= b.n && c.b.e >= b.e)) return;
    const q = buildQuery(b, cats, span);
    if (!q) { setMsg('Pilih minimal satu kategori data.'); return; }
    setMsg('Mengambil data OpenStreetMap…', true);
    try {
      const j = await postOverpass(q);
      let added = 0;
      for (const el of j.elements || []) {
        if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
        const id = 'w' + el.id;
        if (R.ids.has(id)) continue;
        const c = classify(el.tags || {}); if (!c) continue;
        const pts = el.geometry.map((g) => [g.lon, g.lat]);
        if (c.kind === 'area') { const f = pts[0], l = pts[pts.length - 1]; if (f[0] !== l[0] || f[1] !== l[1] || pts.length < 4) continue; pts.pop(); }
        R.ids.add(id); added++;
        const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
        R.items.push({ id, kind: c.kind, type: c.type, cls: c.cls, pts, name: (el.tags && (el.tags.name || el.tags['name:id'])) || '', bb: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)], hw: el.tags && el.tags.highway });
      }
      if (R.items.length > 14000) { R.items.splice(0, R.items.length - 14000); R.ids = new Set(R.items.map((i) => i.id)); R.covered = []; }
      R.covered.push({ ckey, tier, b });
      const n = (j.elements || []).length;
      setMsg(n ? `${R.items.length.toLocaleString('id-ID')} objek tersimpan (+${added} baru).` + (n >= 9000 ? ' Data dipotong, perbesar lebih dekat untuk detail penuh.' : '') : 'Tidak ada data OSM di area ini.');
      MC.invalidate('real'); MC.invalidate('deco');
    } catch (e) {
      console.warn('overpass', e);
      setMsg('Gagal mengambil data: ' + (e.name === 'AbortError' ? 'waktu habis' : e.message) + '. Coba lagi sebentar lagi.');
    }
  };
  MC.clearReal = function () { MC.real.items = []; MC.real.ids = new Set(); MC.real.covered = []; setMsg('Data dihapus.'); MC.invalidate('real'); MC.invalidate('deco'); };

  let t = 0;
  MC.on('view', () => { if (MC.state.real && MC.state.real.on) { clearTimeout(t); t = setTimeout(() => MC.fetchReal(false), 1100); } });

  /* ---------- render ---------- */
  const poolReal = {};
  function pathEl(key, order) {
    if (!poolReal[key]) { poolReal[key] = MC.E('path', { 'data-k': key, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }); poolReal[key]._o = order; }
    return poolReal[key];
  }
  const LORDER = ['water', 'forest', 'park', 'farm', 'desert', 'residential', 'commercial', 'industrial', 'public', 'airport', 'building'];
  const LINE_W = { toll: 5, highway: 4.2, street: 2.6, lane: 1.5, path: 0.9, rail: 1.8, river: 2.4 };

  MC.renderReal = function () {
    const G = MC.L.real, st = MC.state, R = MC.real;
    if (!st.real || !st.real.on || !R.items.length) { if (G.firstChild) G.innerHTML = ''; return; }
    const zf = clamp(Math.pow(st.view.k / 1.5e6, 0.38), 0.5, 2.6), W = MC.W, H = MC.H;
    const dark = d3.hsl(st.style.land).l < 0.45;
    const area = {}, line = {};
    const f1 = (v) => v.toFixed(1);
    for (const it of R.items) {
      let d = '', minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, ok = true;
      const px = [];
      for (const p of it.pts) { const q = MC.px(p); if (!q) { ok = false; break; } px.push(q); if (q[0] < minx) minx = q[0]; if (q[0] > maxx) maxx = q[0]; if (q[1] < miny) miny = q[1]; if (q[1] > maxy) maxy = q[1]; }
      if (!ok || maxx < -20 || minx > W + 20 || maxy < -20 || miny > H + 20) continue;
      if (it.type === 'building' && (maxx - minx < 1.5 && maxy - miny < 1.5)) continue;
      d = 'M' + px.map((q) => f1(q[0]) + ',' + f1(q[1])).join('L') + (it.kind === 'area' ? 'Z' : '');
      const bag = it.kind === 'area' ? area : line;
      (bag[it.type] = bag[it.type] || []).push(d);
    }
    const used = new Set();
    const put = (key, order, d, attrs) => { const e = pathEl(key, order); for (const k in attrs) e.setAttribute(k, attrs[k]); e.setAttribute('d', d.join('')); used.add(key); };
    LORDER.forEach((type, i) => {
      if (!area[type]) return;
      if (type === 'building') put('a-building', 100, area[type], { fill: dark ? '#46557a' : '#d8cfc6', stroke: dark ? '#6f82b0' : '#a89b90', 'stroke-width': 0.7 });
      else { const z = MC.ZONE_TYPES[type]; put('a-' + type, i, area[type], { fill: z.fill, 'fill-opacity': type === 'water' ? 1 : 0.8, stroke: z.stroke, 'stroke-width': 0.6 }); }
    });
    if (line.river) put('l-river', 20, line.river, { stroke: MC.LINE_TYPES.river.color, 'stroke-width': LINE_W.river * zf });
    ['path', 'lane', 'street', 'highway', 'toll'].forEach((type, i) => {
      if (!line[type]) return; const T = MC.LINE_TYPES[type], w = LINE_W[type] * zf;
      if (T.cw) put('lc-' + type, 30 + i * 2, line[type], { stroke: T.cc, 'stroke-width': w + (T.cw - T.w) * Math.min(zf, 1.3) });
      put('l-' + type, 31 + i * 2, line[type], type === 'path' ? { stroke: T.color, 'stroke-width': w, 'stroke-dasharray': '2 3' } : { stroke: T.color, 'stroke-width': w });
    });
    if (line.rail) { put('lc-rail', 50, line.rail, { stroke: '#444', 'stroke-width': LINE_W.rail * zf + 1.6 }); put('l-rail', 51, line.rail, { stroke: '#fff', 'stroke-width': LINE_W.rail * zf, 'stroke-dasharray': '7 7' }); }
    // sinkron DOM sesuai urutan
    const keys = [...used].sort((a, b) => poolReal[a]._o - poolReal[b]._o);
    Array.from(G.children).forEach((c) => { if (!used.has(c.getAttribute('data-k'))) c.remove(); });
    keys.forEach((k, i) => { const e = poolReal[k]; if (G.children[i] !== e) G.insertBefore(e, G.children[i] || null); });
  };

  /* ---------- jadikan objek yang bisa diedit ---------- */
  MC.importReal = function () {
    const R = MC.real, b = MC.viewBBox(); if (!b || !R.items.length) { MC.toast('Belum ada data di area ini'); return; }
    const inView = R.items.filter((i) => i.bb[2] >= b.w && i.bb[0] <= b.e && i.bb[3] >= b.s && i.bb[1] <= b.n);
    const rank = (i) => (i.kind === 'line' ? (i.cls <= 2 ? 0 : i.cls === 5 || i.cls === 6 ? 1 : 3) : i.type === 'building' ? 4 : 2);
    inView.sort((a, c) => rank(a) - rank(c));
    const room = Math.max(0, 600 - MC.state.objects.length), pick = inView.slice(0, room);
    if (!pick.length) { MC.toast('Batas 600 objek tercapai'); return; }
    MC._batch = true; let n = 0;
    try {
      for (const it of pick) {
        let pts = it.pts;
        const px = pts.map((p) => MC.px(p)); if (px.some((q) => !q)) continue;
        const keep = MC.simplifyPx(px, 1.1).map((q) => MC.inv(q)).filter(Boolean);
        if (keep.length < (it.kind === 'area' ? 3 : 2)) continue;
        const o = it.kind === 'line' ? MC.createLine(it.type, keep) : MC.createZone(it.type === 'building' ? 'commercial' : it.type, keep, false);
        if (it.type === 'building') { o.fill = '#d8cfc6'; o.stroke = '#a89b90'; o.sw = 0.8; o.fillOp = 1; o.name = it.name || 'Bangunan'; o.legend = 'Bangunan'; }
        else o.name = it.name || o.name;
        if (it.kind === 'line' && it.name && it.cls <= 2) o.label = it.name;
        if (it.kind === 'line') { o.w = LINE_W[it.type] * 1.3; if (o.cw) o.cw = o.cw * 0.8; }
        MC.touch(o); n++;
      }
    } finally { MC._batch = false; }
    MC.sel = null; MC.invalidate('all'); MC.commit(); MC.emit('selection'); MC.emit('layers');
    MC.toast(`${n} objek diimpor ke lapisan (bisa diedit)`);
  };
})(window.MC);
