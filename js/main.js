/* Inisialisasi aplikasi */
(function (MC) {
  window.addEventListener('DOMContentLoaded', () => {
    MC.initData();
    MC.initSvg();
    MC.initUI();
    MC.initTools();
    MC.initExport();
    MC.layoutPage();

    let loaded = false;
    try {
      const raw = localStorage.getItem('mapcreator.autosave');
      if (raw) { const d = JSON.parse(raw); if (d && d.app === 'map-creator') { MC.loadDoc(d); MC.layoutPage(); loaded = true; } }
    } catch (e) { console.warn('autosave gagal dimuat', e); }
    if (!loaded) MC.setView(MC.fitScope(MC.state.scope));
    else MC.syncProj();
    MC.resetHistory();
    MC.setTool('select');
    MC.invalidate('all');

    new ResizeObserver(() => { if (MC.layoutPage()) MC.invalidate('all'); }).observe(document.getElementById('canvasWrap'));
    window.addEventListener('beforeunload', () => { try { localStorage.setItem('mapcreator.autosave', JSON.stringify(MC.state, (k, v) => (k[0] === '_' ? undefined : v))); } catch (e) {} });

    if (!localStorage.getItem('mapcreator.seen')) {
      try { localStorage.setItem('mapcreator.seen', '1'); } catch (e) {}
      setTimeout(() => document.getElementById('helpDlg').showModal(), 500);
    }
  });
})(window.MC);
