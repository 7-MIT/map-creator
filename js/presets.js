/* Preset: jenis zona, jalan, penanda, tema, animasi */
window.MC = window.MC || {};
(function (MC) {
  MC.ZONE_TYPES = {
    land:       { label: 'Daratan / Pulau',    fill: '#efe4bd', stroke: '#8d7f55', sw: 1.4, pattern: 'none',  pc: '#b5a574' },
    water:      { label: 'Laut / Danau',       fill: '#9fcdf0', stroke: '#5b9bd0', sw: 1.2, pattern: 'waves', pc: '#ffffff' },
    residential:{ label: 'Pemukiman',          fill: '#f7d19b', stroke: '#d49a4a', sw: 1,   pattern: 'dots',  pc: '#c9873a' },
    commercial: { label: 'Komersial / Bisnis', fill: '#f4a7a0', stroke: '#d0605a', sw: 1,   pattern: 'none',  pc: '#b03a34' },
    industrial: { label: 'Kawasan Industri',   fill: '#c9bbe3', stroke: '#8a73b8', sw: 1,   pattern: 'hatch', pc: '#8a73b8' },
    park:       { label: 'Taman / Area Hijau', fill: '#aee0a6', stroke: '#5cab62', sw: 1,   pattern: 'none',  pc: '#3f8a4c' },
    forest:     { label: 'Hutan',              fill: '#78bd80', stroke: '#3f8a4c', sw: 1,   pattern: 'dots',  pc: '#2f6d3a' },
    farm:       { label: 'Pertanian / Sawah',  fill: '#e6eba0', stroke: '#b0b845', sw: 1,   pattern: 'lines', pc: '#a5ad3a' },
    desert:     { label: 'Gurun / Pasir',      fill: '#f6e0a8', stroke: '#d4b25c', sw: 1,   pattern: 'dots',  pc: '#cfa64a' },
    mountain:   { label: 'Pegunungan',         fill: '#cdbcaa', stroke: '#8f7b66', sw: 1,   pattern: 'hatch', pc: '#8f7b66' },
    public:     { label: 'Fasilitas Umum',     fill: '#bcd7e8', stroke: '#5f90b3', sw: 1,   pattern: 'none',  pc: '#5f90b3' },
    airport:    { label: 'Bandara',            fill: '#d9dde0', stroke: '#8a9399', sw: 1,   pattern: 'cross', pc: '#8a9399' },
    custom:     { label: 'Kustom',             fill: '#ffd166', stroke: '#c9972b', sw: 1.5, pattern: 'none',  pc: '#c9972b' }
  };

  MC.LINE_TYPES = {
    toll:    { label: 'Jalan Tol',          w: 6,   color: '#f6a55a', cw: 9.5, cc: '#a1481a', center: '#ffffff', centerDash: '9 7', centerW: 1.3, dash: '', smooth: false },
    highway: { label: 'Jalan Raya',         w: 5,   color: '#ffe08a', cw: 8,   cc: '#c49a1c', center: '', dash: '', smooth: false },
    street:  { label: 'Jalan Biasa',        w: 3,   color: '#ffffff', cw: 5.5, cc: '#a3a3a3', center: '', dash: '', smooth: false },
    lane:    { label: 'Jalan Kecil / Gang', w: 1.6, color: '#ffffff', cw: 3.2, cc: '#c0c0c0', center: '', dash: '', smooth: false },
    path:    { label: 'Jalan Setapak',      w: 1.6, color: '#8d6e63', cw: 0,   cc: '#000000', center: '', dash: '2 4', smooth: true },
    rail:    { label: 'Rel Kereta',         w: 2.4, color: '#ffffff', cw: 4.6, cc: '#333333', center: '', dash: '9 9', smooth: false },
    river:   { label: 'Sungai',             w: 3.2, color: '#6fb1e6', cw: 0,   cc: '#000000', center: '', dash: '', smooth: true },
    border:  { label: 'Batas Wilayah',      w: 1.8, color: '#c0392b', cw: 0,   cc: '#000000', center: '', dash: '9 4 2 4', smooth: false },
    route:   { label: 'Rute / Penerbangan', w: 2.4, color: '#e53935', cw: 0,   cc: '#000000', center: '', dash: '7 6', smooth: true, arrow: 'end', anim: 'flow' },
    custom:  { label: 'Kustom',             w: 3,   color: '#3b82f6', cw: 0,   cc: '#000000', center: '', dash: '', smooth: false }
  };

  // shape: dot|square|diamond|triangle|star|pin|glyph
  MC.MARKER_TYPES = {
    metropolis: { label: 'Kota Besar',     shape: 'dot',      size: 11, color: '#e53935', stroke: '#ffffff', lbl: 15, bold: true,  name: 'Kota Besar' },
    city:       { label: 'Kota',           shape: 'dot',      size: 8,  color: '#fb8c00', stroke: '#ffffff', lbl: 13, bold: false, name: 'Kota' },
    town:       { label: 'Kota Kecil/Desa',shape: 'dot',      size: 5.5,color: '#fdd835', stroke: '#6d6d6d', lbl: 11, bold: false, name: 'Desa' },
    capital:    { label: 'Ibu Kota',       shape: 'star',     size: 17, color: '#d81b60', stroke: '#ffffff', lbl: 15, bold: true,  name: 'Ibu Kota' },
    landmark:   { label: 'Lokasi (Pin)',   shape: 'pin',      size: 24, color: '#e53935', stroke: '#ffffff', lbl: 13, bold: true,  name: 'Lokasi' },
    airport:    { label: 'Bandara',        shape: 'icon', icon: 'plane', size: 20, color: '#3b82f6', stroke: '#ffffff', lbl: 12, bold: false, name: 'Bandara' },
    port:       { label: 'Pelabuhan',      shape: 'icon', icon: 'anchor', size: 20, color: '#1e88e5', stroke: '#ffffff', lbl: 12, bold: false, name: 'Pelabuhan' },
    station:    { label: 'Stasiun',        shape: 'icon', icon: 'train-front', size: 20, color: '#1e88e5', stroke: '#ffffff', lbl: 12, bold: false, name: 'Stasiun' },
    hospital:   { label: 'Rumah Sakit',    shape: 'icon', icon: 'hospital', size: 20, color: '#e53935', stroke: '#ffffff', lbl: 12, bold: false, name: 'Rumah Sakit' },
    school:     { label: 'Sekolah/Kampus', shape: 'icon', icon: 'graduation-cap', size: 20, color: '#8e24aa', stroke: '#ffffff', lbl: 12, bold: false, name: 'Sekolah' },
    hotel:      { label: 'Hotel',          shape: 'icon', icon: 'bed-double', size: 20, color: '#8e24aa', stroke: '#ffffff', lbl: 12, bold: false, name: 'Hotel' },
    mountain:   { label: 'Gunung',         shape: 'triangle', size: 15, color: '#8d6e63', stroke: '#ffffff', lbl: 12, bold: false, name: 'Gunung' },
    park:       { label: 'Taman / Wisata', shape: 'icon', icon: 'trees', size: 20, color: '#43a047', stroke: '#ffffff', lbl: 12, bold: false, name: 'Taman' },
    flag:       { label: 'Bendera',        shape: 'icon', icon: 'flag', size: 20, color: '#e53935', stroke: '#ffffff', lbl: 12, bold: false, name: 'Titik' },
    square:     { label: 'Kotak',          shape: 'square',   size: 10, color: '#546e7a', stroke: '#ffffff', lbl: 12, bold: false, name: 'Titik' },
    diamond:    { label: 'Berlian',        shape: 'diamond',  size: 12, color: '#00acc1', stroke: '#ffffff', lbl: 12, bold: false, name: 'Titik' },
    custom:     { label: 'Kustom (emoji)', shape: 'icon', icon: 'star', size: 22, color: '#f9a825', stroke: '#ffffff', lbl: 13, bold: false, name: 'Titik' }
  };

  MC.ICON_CHOICES = ['plane','ship','anchor','train-front','bus','car','bike','fuel','hospital','graduation-cap','bed-double','building','building-2','factory','store','shopping-cart','utensils','coffee','church','landmark','castle','tent','tower-control','trees','mountain','waves','droplets','wheat','flag','map-pin','star','heart','flame','triangle-alert','info','camera','house'];
  MC.REAL_DEFAULT = { on: false, roads: true, buildings: true, landuse: true, water: true, rail: true };
  MC.GLYPHS = ['✈️','🚢','⚓','🚉','🚌','🚗','🚲','⛽','🏥','🏫','🏨','🏠','🏢','🏭','🏪','🛒','🍴','☕','⛪','🕌','🛕','⛩️','🏰','🗼','🏛️','🏟️','🌳','⛰️','🌋','🏝️','🏖️','🌊','🚩','📍','⭐','❤️','🔥','⚠️','ℹ️','📷'];

  MC.FONTS = ['Georgia', 'Arial', 'Verdana', 'Trebuchet MS', 'Tahoma', 'Times New Roman', 'Courier New', 'Impact', 'Palatino Linotype', 'Comic Sans MS', 'sans-serif', 'serif', 'cursive', 'monospace'];

  MC.PALETTES = {
    pastel: ['#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6', '#ffffcc', '#e5d8bd'],
    earth:  ['#d9c49a', '#c9d3a3', '#e3b99a', '#b9cdb0', '#e8d6a8', '#cfc0a6', '#dfc7b0'],
    dark:   ['#2f4468', '#33506b', '#3a4a73', '#2c5a66', '#404a7a', '#2a4f5e', '#3c4d63'],
    blue:   ['#1b5a9c', '#216aae', '#1a6397', '#2574b5', '#195388', '#2b7cb8', '#1d5f99']
  };

  MC.THEMES = {
    classic: { label: 'Klasik', pal: 'pastel', style: { ocean: '#bfe3f7', pageBg: '#dfe8ee', land: '#f4efe1', dim: '#e4e0d4', border: '#9a8f78', bw: 0.6, adminBorder: '#b5ab94', aw: 0.5, text: '#3a3a3a', halo: '#ffffff', gratColor: '#ffffff', colorize: false, graticule: true, shadow: false } },
    political:{ label: 'Politik', pal: 'pastel', style: { ocean: '#c6e6f5', pageBg: '#dfe8ee', land: '#f4efe1', dim: '#ececec', border: '#ffffff', bw: 0.9, adminBorder: '#ffffff', aw: 0.7, text: '#2b2b2b', halo: '#ffffff', gratColor: '#ffffff', colorize: true, graticule: false, shadow: false } },
    dark:    { label: 'Gelap', pal: 'dark', style: { ocean: '#0e1726', pageBg: '#0a111d', land: '#27364f', dim: '#1b2638', border: '#4b5f82', bw: 0.6, adminBorder: '#3b4c6b', aw: 0.5, text: '#dbe5f5', halo: '#0e1726', gratColor: '#6f86b0', colorize: false, graticule: true, shadow: false } },
    antique: { label: 'Kertas Antik', pal: 'earth', style: { ocean: '#d8c9a2', pageBg: '#c9b88c', land: '#f2e4bd', dim: '#e2d3ab', border: '#8b6b3e', bw: 0.8, adminBorder: '#a98b5a', aw: 0.5, text: '#4a3519', halo: '#f2e4bd', gratColor: '#8b6b3e', colorize: false, graticule: true, shadow: true } },
    blueprint:{ label: 'Blueprint', pal: 'blue', style: { ocean: '#0b3a6b', pageBg: '#082b50', land: '#14589a', dim: '#0f4a82', border: '#9cc9f2', bw: 0.7, adminBorder: '#6aa5d9', aw: 0.5, text: '#e8f3ff', halo: '#0b3a6b', gratColor: '#9cc9f2', colorize: false, graticule: true, shadow: false } },
    earth:   { label: 'Bumi', pal: 'earth', style: { ocean: '#2d6da3', pageBg: '#0b1b2e', land: '#7fae62', dim: '#6a9553', border: '#4f7a3d', bw: 0.5, adminBorder: '#5f8c4b', aw: 0.4, text: '#ffffff', halo: '#1d3d5c', gratColor: '#ffffff', colorize: false, graticule: false, shadow: false } },
    mono:    { label: 'Monokrom', pal: 'pastel', style: { ocean: '#ffffff', pageBg: '#ffffff', land: '#eeeeee', dim: '#f6f6f6', border: '#555555', bw: 0.6, adminBorder: '#999999', aw: 0.4, text: '#111111', halo: '#ffffff', gratColor: '#bbbbbb', colorize: false, graticule: false, shadow: false } }
  };

  MC.PROJ = {
    naturalEarth:  { label: 'Natural Earth',          make: () => d3.geoNaturalEarth1() },
    mercator:      { label: 'Mercator (peta web)',    make: () => d3.geoMercator(), rect: true },
    equalEarth:    { label: 'Equal Earth',            make: () => d3.geoEqualEarth() },
    equirect:      { label: 'Datar (Equirectangular)',make: () => d3.geoEquirectangular(), rect: true },
    orthographic:  { label: 'Globe 3D (Ortografis)',  make: () => d3.geoOrthographic(), az: true, clip: 90 },
    stereographic: { label: 'Stereografis (kutub)',   make: () => d3.geoStereographic(), az: true, clip: 130 },
    azimuthal:     { label: 'Azimut Luas-Sama',       make: () => d3.geoAzimuthalEqualArea(), az: true, clip: 170 }
  };

  MC.SCOPE_BOXES = {
    'Asia':          [30, -12, 146, 58],
    'Europe':        [-25, 33, 50, 72],
    'Africa':        [-20, -36, 53, 38],
    'North America': [-170, 6, -50, 72],
    'South America': [-83, -56, -33, 13],
    'Oceania':       [110, -48, 180, 2],
    'Antarctica':    [-180, -90, 180, -62]
  };
  MC.CONTINENT_LABELS = { 'Asia': 'Asia', 'Europe': 'Eropa', 'Africa': 'Afrika', 'North America': 'Amerika Utara', 'South America': 'Amerika Selatan', 'Oceania': 'Oseania', 'Antarctica': 'Antartika' };

  MC.ANIM_CSS = `
@keyframes mc-ripple{0%{transform:scale(.3);opacity:.85}100%{transform:scale(2.8);opacity:0}}
@keyframes mc-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes mc-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}
@keyframes mc-spin{to{transform:rotate(360deg)}}
@keyframes mc-flow{to{stroke-dashoffset:var(--dp,-28px)}}
@keyframes mc-draw{0%{stroke-dashoffset:1}65%,100%{stroke-dashoffset:0}}
@keyframes mc-breathe{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes mc-glow{0%,100%{filter:drop-shadow(0 0 0 currentColor)}50%{filter:drop-shadow(0 0 9px currentColor)}}
@keyframes mc-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes mc-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes mc-pop{0%{transform:scale(0)}65%{transform:scale(1.3)}100%{transform:scale(1)}}
.a-box{transform-box:fill-box;transform-origin:center}
.a-ripple{animation:mc-ripple 2.2s ease-out infinite;transform-box:fill-box;transform-origin:center}
.a-bounce{animation:mc-bounce 1s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.a-pulse{animation:mc-pulse 1.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.a-spin{animation:mc-spin 3s linear infinite;transform-box:fill-box;transform-origin:center}
.a-pop{animation:mc-pop .55s cubic-bezier(.3,1.5,.5,1) both;transform-box:fill-box;transform-origin:center}
.a-flow{animation:mc-flow 1s linear infinite}
.a-draw{stroke-dasharray:1 !important;animation:mc-draw 3.2s ease-in-out infinite}
.a-breathe{animation:mc-breathe 2.4s ease-in-out infinite}
.a-glow{animation:mc-glow 2s ease-in-out infinite}
.a-float{animation:mc-float 2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.a-blink{animation:mc-blink 1.2s steps(1) infinite}
`;
})(window.MC);
