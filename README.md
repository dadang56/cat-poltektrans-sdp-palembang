# CAT POLTEKTRANS SDP PALEMBANG

Sistem Computer Assisted Test (CAT) untuk Politeknik Transportasi SDP Palembang.

## 🚀 Fitur Utama

- **Multi-Role**: Admin, Admin Prodi, Dosen, Mahasiswa, Pengawas
- **Manajemen Ujian**: Jadwal, Soal, Sesi Ujian
- **Anti-Cheating**: SEB Mode, Fullscreen Lock, Tab Monitoring
- **Rekap & Laporan**: Nilai, Kehadiran, Berita Acara
- **Export Excel**: Format XLSX untuk semua laporan

---

## 📋 Persyaratan Sistem

- Node.js 18+ (untuk development)
- Web Server dengan PHP (untuk Indonesian Hosting)
- Browser modern (Chrome, Firefox, Edge, Safari)

---

## 🔧 Instalasi Development

```bash
# Clone repository
git clone [repository-url]
cd cat-poltektrans-sdp-palembang

# Install dependencies
npm install

# Jalankan development server
npm run dev

# Build production
npm run build
```

---

## 🌐 Deploy ke Indonesian Hosting (IDCloudHost, Niagahoster, Rumahweb, dll)

### Langkah 1: Build Aplikasi

```bash
npm run build
```

Folder `dist` akan dibuat berisi file-file production.

### Langkah 2: Upload ke Hosting

1. Login ke cPanel hosting Anda
2. Buka **File Manager**
3. Navigasi ke folder `public_html` (atau subdomain tujuan)
4. **Upload semua isi folder `dist`** ke `public_html`:
   - `index.html`
   - `assets/` (folder)
   - `.htaccess`

### Langkah 3: Verifikasi .htaccess

Pastikan file `.htaccess` sudah terupload. File ini diperlukan untuk:
- SPA routing (agar refresh tidak 404)
- GZIP compression
- Browser caching

### Langkah 4: Test Aplikasi

Buka URL hosting Anda (misal: `https://cat.poltektrans-sdp.ac.id`)

---

## 📁 Struktur Folder Dist

```
dist/
├── index.html          # Entry point
├── assets/
│   ├── index-*.css     # Stylesheet
│   └── index-*.js      # JavaScript bundle
└── .htaccess           # Apache configuration
```

---

## 👤 Akun Default

| Role | Username | Password |
|------|----------|----------|
| Superadmin | admin | admin |
| Admin Prodi | dadang1 | 123456 |
| Dosen | dosen1 | 123456 |
| Mahasiswa | mhs1 | 123456 |
| Pengawas | pengawas1 | 123456 |

> ⚠️ **Penting**: Ubah password default setelah deploy!

---

## 🔒 Keamanan

1. Ubah semua password default
2. Gunakan HTTPS (SSL Certificate)
3. Backup data secara berkala
4. Batasi akses ke file sensitif

---

## 📖 Dokumentasi Lanjutan

- [Panduan Pengguna](./PANDUAN_PENGGUNA.md) - Panduan lengkap penggunaan aplikasi
- [Changelog](./CHANGELOG.md) - Riwayat perubahan

---

## 🛠️ Troubleshooting

### Halaman 404 saat refresh
Pastikan `.htaccess` sudah terupload dan mod_rewrite aktif di hosting.

### Aplikasi lambat
- Aktifkan GZIP compression di hosting
- Gunakan CDN jika diperlukan

### Data tidak tersimpan
Aplikasi menggunakan localStorage browser. Data tersimpan per-browser.

---

## 📞 Kontak

Untuk bantuan teknis, hubungi:
- Email: [your-email@poltektrans-sdp.ac.id]
- Tim IT Poltektrans SDP Palembang

---

**© 2025 Politeknik Transportasi SDP Palembang**
