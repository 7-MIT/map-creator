/* Ekspor: PNG, SVG, PDF + simpan/buka proyek */
(function (MC) {
  const $ = (s) => document.querySelector(s);

  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  MC.exportSvgString = function (opt) {
    opt = opt || {};
    const svg = MC.svg.cloneNode(true);
    svg.removeAttribute('style'); svg.removeAttribute('id');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svg.setAttribute('width', MC.W); svg.setAttribute('height', MC.H); svg.setAttribute('viewBox', `0 0 ${MC.W} ${MC.H}`);
    svg.querySelector('#g-ui').remove();
    svg.querySelectorAll('.hit').forEach((e) => e.remove());
    svg.querySelectorAll('[data-oid],[data-bid]').forEach((e) => { e.removeAttribute('data-bid'); e.removeAttribute('data-bn'); e.removeAttribute('data-lv'); });
    if (opt.transparent) {
      const bg = svg.querySelector('#g-bg rect'); if (bg) bg.setAttribute('fill', 'none');
      const P = MC.PROJ[MC.state.projection]; if (P.rect) { const sp = svg.querySelector('#g-sphere path'); if (sp) sp.setAttribute('fill', 'none'); }
    }
    if (!opt.anim) {
      const st = svg.querySelector('#animStyle'); if (st) st.remove();
      svg.querySelectorAll('.a-ripple').forEach((e) => e.remove());
      svg.querySelectorAll('[class*="a-"]').forEach((e) => {
        const keep = (e.getAttribute('class') || '').split(/\s+/).filter((c) => c && !/^a-/.test(c));
        if (keep.length) e.setAttribute('class', keep.join(' ')); else e.removeAttribute('class');
        e.style.animation = ''; e.style.animationDelay = '';
      });
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
  };

  MC.renderCanvas = async function (scale, opt) {
    const maxPx = 80e6;
    scale = Math.min(scale, Math.sqrt(maxPx / (MC.W * MC.H)), 16384 / Math.max(MC.W, MC.H));
    const s = MC.exportSvgString(Object.assign({ anim: false }, opt));
    const url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Gagal merender gambar peta')); img.src = url; });
    const c = document.createElement('canvas');
    c.width = Math.round(MC.W * scale); c.height = Math.round(MC.H * scale);
    const ctx = c.getContext('2d');
    if (!(opt && opt.transparent)) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return c;
  };
  const canvasBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));

  const PAPER = { a5: [148, 210], a4: [210, 297], a3: [297, 420], a2: [420, 594], letter: [215.9, 279.4] };

  MC.doExport = async function () {
    const fmt = document.querySelector('input[name=expFmt]:checked').value;
    const name = ($('#expName').value || 'peta').trim() || 'peta';
    const scale = +$('#expScale').value, transparent = $('#expTrans').checked;
    const btn = $('#expGo'); btn.disabled = true; const old = btn.textContent; btn.textContent = 'Memproses…';
    MC.hideUI = true; MC.renderUI();
    try {
      if (fmt === 'svg') {
        saveBlob(new Blob([MC.exportSvgString({ anim: $('#expAnim').checked, transparent })], { type: 'image/svg+xml' }), name + '.svg');
      } else if (fmt === 'png' || fmt === 'jpg') {
        const c = await MC.renderCanvas(scale, { transparent: fmt === 'png' && transparent });
        const b = await canvasBlob(c, fmt === 'png' ? 'image/png' : 'image/jpeg', 0.93);
        saveBlob(b, name + (fmt === 'png' ? '.png' : '.jpg'));
      } else if (fmt === 'pdf') {
        const { jsPDF } = window.jspdf;
        const paperKey = $('#expPaper').value, margin = +$('#expMargin').value;
        let pw, ph;
        if (paperKey === 'fit') { pw = (MC.W * 25.4) / 96; ph = (MC.H * 25.4) / 96; margin && (pw += margin * 2, ph += margin * 2); }
        else { [pw, ph] = PAPER[paperKey]; const land = $('#expOrient').value === 'auto' ? MC.W >= MC.H : $('#expOrient').value === 'l'; if (land) [pw, ph] = [ph, pw]; }
        const aw = pw - margin * 2, ah = ph - margin * 2, r = Math.min(aw / MC.W, ah / MC.H);
        const dw = MC.W * r, dh = MC.H * r;
        const dpi = +$('#expDpi').value, scalePdf = Math.max(1, (dw / 25.4 * dpi) / MC.W);
        const c = await MC.renderCanvas(scalePdf, { transparent: false });
        const doc = new jsPDF({ orientation: pw > ph ? 'l' : 'p', unit: 'mm', format: [pw, ph], compress: true });
        doc.setProperties({ title: MC.state.layout.title.text || name, creator: 'Map Creator' });
        doc.addImage(c.toDataURL('image/png'), 'PNG', (pw - dw) / 2, (ph - dh) / 2, dw, dh, undefined, 'FAST');
        doc.save(name + '.pdf');
      }
      MC.toast('Berhasil diekspor ✓');
      $('#exportDlg').close();
    } catch (err) {
      console.error(err); MC.toast('Ekspor gagal: ' + err.message, 4000);
    } finally { MC.hideUI = false; MC.invalidate('ui'); btn.disabled = false; btn.textContent = old; }
  };

  MC.saveProject = function () {
    const d = JSON.parse(JSON.stringify(MC.state, (k, v) => (k[0] === '_' ? undefined : v)));
    saveBlob(new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' }), MC.slug(MC.state.layout.title.text) + '.mapcreator.json');
    MC.toast('Proyek disimpan ✓');
  };
  MC.openProjectFile = function (file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        if (d.app !== 'map-creator') throw new Error('Bukan file proyek Map Creator');
        MC.loadDoc(d); MC.layoutPage(); MC.resetHistory(); MC.toast('Proyek dibuka ✓');
      } catch (e) { MC.toast('Gagal membuka: ' + e.message, 4000); }
    };
    fr.readAsText(file);
  };
  MC.newProject = function () {
    if (MC.state.objects.length && !confirm('Mulai proyek baru? Perubahan yang belum disimpan akan hilang.')) return;
    MC.loadDoc(MC.defaultDoc()); MC.layoutPage(); MC.setView(MC.fitScope(MC.state.scope)); MC.resetHistory(); MC.setTool('select');
  };

  MC.initExport = function () {
    const dlg = $('#exportDlg');
    const upd = () => {
      const fmt = document.querySelector('input[name=expFmt]:checked').value;
      $('#pngOpts').style.display = fmt === 'png' || fmt === 'jpg' ? '' : 'none';
      $('#pdfOpts').style.display = fmt === 'pdf' ? '' : 'none';
      $('#svgOpts').style.display = fmt === 'svg' ? '' : 'none';
      $('#expTransRow').style.display = fmt === 'png' || fmt === 'svg' ? '' : 'none';
      const sc = +$('#expScale').value;
      $('#expInfo').textContent = fmt === 'png' || fmt === 'jpg' ? `Ukuran gambar: ${Math.round(MC.W * sc)} × ${Math.round(MC.H * sc)} px` : fmt === 'svg' ? `Vektor ${MC.W} × ${MC.H} — bisa diedit di Inkscape / Illustrator` : 'Peta dimasukkan ke halaman PDF beresolusi tinggi';
    };
    document.querySelectorAll('input[name=expFmt],#expScale').forEach((e) => e.addEventListener('change', upd));
    $('#expPaper').addEventListener('change', () => { $('#expOrientRow').style.display = $('#expPaper').value === 'fit' ? 'none' : ''; });
    $('#btnExport').onclick = () => { $('#expName').value = MC.slug(MC.state.layout.title.text); upd(); dlg.showModal(); };
    $('#expCancel').onclick = () => dlg.close();
    $('#expGo').onclick = MC.doExport;
    // menu proyek
    const menu = $('#projMenu');
    $('#btnProject').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('show'); };
    document.addEventListener('click', () => menu.classList.remove('show'));
    $('#mNew').onclick = MC.newProject;
    $('#mOpen').onclick = () => $('#openFile').click();
    $('#mSave').onclick = MC.saveProject;
    $('#mDemo').onclick = () => { if (!MC.state.objects.length || confirm('Ganti peta saat ini dengan contoh?')) MC.loadDemo(); };
    $('#openFile').onchange = (e) => { if (e.target.files[0]) MC.openProjectFile(e.target.files[0]); e.target.value = ''; };
    $('#btnHelp').onclick = () => $('#helpDlg').showModal();
    $('#helpClose').onclick = () => $('#helpDlg').close();
  };
})(window.MC);
