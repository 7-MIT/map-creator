# Map Creator

Editor peta interaktif yang jalan di browser, tanpa server dan tanpa build. Buka `index.html` dan mulai.

## Fitur

- **Peta dasar**: dunia, 6 benua + Antartika, ±250 negara lengkap dengan provinsi, atau kanvas kosong untuk menggambar bentuk sendiri.
- **Objek**: kota dan titik (ikon Lucide atau emoji), jalan (tol, raya, biasa, gang, setapak, rel, sungai, batas, rute), zona (pemukiman, komersial, industri, taman, hutan, sawah, gurun, dll), persegi, lingkaran, gambar bebas, dan teks.
- **Kustomisasi**: warna, ketebalan, pola garis dan isi, label, font, transparansi, lengkung halus, panah.
- **Animasi**: riak, lompat, denyut, aliran garis, garis menggambar diri, globe berputar, dan tur terbang antar penanda.
- **Data nyata**: nyalakan di tab Peta, perbesar ke sebuah area, lalu tarik jalan, bangunan, dan zona dari OpenStreetMap (Overpass API). Hasilnya bisa dijadikan objek yang dapat diedit.
- **Tata letak**: judul, legenda otomatis, skala, kompas, bingkai, dan rasio kertas.
- **Ekspor**: PNG, JPG, PDF, SVG (dengan animasi), serta simpan dan buka proyek (`.json`). Pekerjaan tersimpan otomatis di browser.

## Struktur

| Path | Isi |
| --- | --- |
| `js/core.js` | state, proyeksi, zoom dan pan, undo/redo |
| `js/render.js` | peta dasar, objek, dekorasi |
| `js/tools.js` | interaksi menggambar dan edit |
| `js/real.js` | data OpenStreetMap |
| `js/ui.js` | panel dan toolbar |
| `js/export.js` | ekspor dan proyek |
| `data/` | Natural Earth (domain publik), sudah disederhanakan |
| `vendor/` | d3, topojson-client, jsPDF; ikon dari Lucide (lisensi ISC) |

Data peta dasar dari Natural Earth. Data nyata © kontributor OpenStreetMap (ODbL).
