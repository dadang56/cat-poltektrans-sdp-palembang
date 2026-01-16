# 📚 Panduan Deployment CAT Poltektrans SDP Palembang

Tutorial lengkap untuk deploy aplikasi ke indo.hostings.

---

## 📋 Daftar Isi

1. [Persiapan](#1-persiapan)
2. [Build Production](#2-build-production)
3. [Upload ke indo.hostings](#3-upload-ke-indohostings)
4. [Konfigurasi Domain](#4-konfigurasi-domain)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Persiapan

### Persyaratan
- ✅ Akun indo.hostings aktif dengan paket hosting
- ✅ Domain atau subdomain yang sudah terdaftar
- ✅ Node.js versi 18+ terinstall di komputer lokal
- ✅ Akses ke folder project aplikasi

### Struktur File yang Akan Diupload
```
dist/
├── .htaccess          # Konfigurasi Apache untuk SPA
├── index.html         # Entry point aplikasi
├── favicon.png        # (Opsional) Icon browser tab
├── assets/
│   ├── index-xxx.css  # Stylesheet
│   └── index-xxx.js   # JavaScript bundle
└── vite.svg           # Logo placeholder
```

---

## 2. Build Production

### Langkah 1: Buka Terminal
Navigasi ke folder project:
```bash
cd /path/to/cat-poltektrans-sdp-palembang
```

### Langkah 2: Install Dependencies (Jika Belum)
```bash
npm install
```

### Langkah 3: Build Aplikasi
```bash
npm run build
```

### Langkah 4: Verifikasi Build
```bash
npm run preview
```
Buka browser ke `http://localhost:4173` untuk memastikan aplikasi berjalan.

### Langkah 5: Siapkan File untuk Upload
Folder `dist/` sudah siap untuk diupload. Anda bisa:

**Opsi A - ZIP folder:**
```bash
cd dist
zip -r ../cat-poltektrans-deploy.zip .
```

**Opsi B - Upload langsung via File Manager**

---

## 3. Upload ke indo.hostings

### Langkah 1: Login ke cPanel
1. Buka `https://[nama-domain].indo.hostings/cpanel` atau gunakan link dari email konfirmasi
2. Masukkan username dan password hosting

### Langkah 2: Buka File Manager
1. Di cPanel, cari icon **"File Manager"**
2. Klik untuk membuka

### Langkah 3: Navigasi ke public_html
1. Di panel kiri, klik folder **"public_html"**
2. Ini adalah folder root website Anda

### Langkah 4: Upload File

**Jika menggunakan ZIP:**
1. Klik tombol **"Upload"** di toolbar
2. Pilih file `cat-poltektrans-deploy.zip`
3. Tunggu upload selesai
4. Klik kanan file ZIP → **"Extract"**
5. Pilih **"Extract Files Here"**
6. Hapus file ZIP setelah extract

**Jika upload manual:**
1. Klik **"Upload"**
2. Pilih semua file dari folder `dist/`
3. Upload juga folder `assets/` dengan isinya

### Langkah 5: Pastikan File .htaccess Ada
File `.htaccess` WAJIB ada di public_html. Jika tidak terlihat:
1. Klik **"Settings"** (pojok kanan atas File Manager)
2. Centang **"Show Hidden Files"**
3. Klik **"Save"**

---

## 4. Konfigurasi Domain

### Untuk Domain Utama
File sudah berada di `public_html/` → Akses langsung via domain utama.

### Untuk Subdomain (Contoh: cat.poltektrans.ac.id)
1. Di cPanel, cari **"Subdomains"**
2. Klik untuk membuka
3. Isi:
   - Subdomain: `cat`
   - Domain: pilih domain utama
   - Document Root: otomatis terisi (biasanya `public_html/cat`)
4. Klik **"Create"**
5. Upload file ke folder subdomain yang baru dibuat

### Aktifkan SSL (HTTPS)
1. Cari **"SSL/TLS Status"** di cPanel
2. Klik **"Run AutoSSL"**
3. Tunggu beberapa menit
4. Website sekarang bisa diakses via HTTPS

---

## 5. Troubleshooting

### ❌ Halaman tidak ditemukan (404) saat refresh

**Penyebab:** File `.htaccess` tidak ada atau mod_rewrite tidak aktif.

**Solusi:**
1. Pastikan file `.htaccess` sudah terupload
2. Isi file `.htaccess`:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [QSA,L]
</IfModule>
```
3. Hubungi support indo.hostings untuk mengaktifkan mod_rewrite

### ❌ CSS/JavaScript tidak loading

**Penyebab:** Path file salah atau file belum terupload.

**Solusi:**
1. Pastikan folder `assets/` sudah terupload lengkap
2. Cek di browser (F12 → Console) untuk melihat error
3. Pastikan tidak ada typo di nama file

### ❌ Blank page / loading terus

**Penyebab:** JavaScript error atau file corrupt.

**Solusi:**
1. Clear cache browser (Ctrl+Shift+R)
2. Cek Console di browser untuk error
3. Rebuild dan upload ulang

### ❌ Font tidak tampil benar

**Penyebab:** Google Fonts terblokir atau internet lambat.

**Solusi:**
Fonts akan loading dari Google CDN. Pastikan:
1. Tidak ada firewall yang memblokir fonts.googleapis.com
2. Koneksi internet stabil

---

## 🚀 Checklist Sebelum Go Live

- [ ] Semua file dari `dist/` sudah terupload
- [ ] File `.htaccess` ada dan tidak hidden
- [ ] SSL/HTTPS sudah aktif
- [ ] Test login semua role (Super Admin, Admin Prodi, Dosen, Pengawas, Mahasiswa)
- [ ] Test refreshing di halaman selain login (contoh: /admin/dashboard)
- [ ] Upload logo institusi via menu Settings
- [ ] Ganti password default untuk akun demo

---

## 📞 Bantuan

- **indo.hostings Support:** Live chat di dashboard atau email support
- **Dokumentasi cPanel:** https://docs.cpanel.net

---

*Panduan ini dibuat untuk CAT Poltektrans SDP Palembang - Januari 2026*

---

## 6. GitHub + Auto Deploy (Recommended) 🚀

Dengan cara ini, setiap kali Anda update kode dan `git push`, website otomatis ter-update!

---

### 6.1 Buat Repository GitHub

**Langkah 1: Buka GitHub**
1. Buka https://github.com
2. Login dengan akun Anda (atau daftar gratis jika belum punya)

**Langkah 2: Buat Repository Baru**
1. Klik tombol **"+"** di pojok kanan atas
2. Pilih **"New repository"**
3. Isi form:
   - **Repository name**: `cat-poltektrans-sdp-palembang`
   - **Description**: `Sistem CAT Politeknik Transportasi SDP Palembang`
   - **Visibility**: Pilih `Private` (rahasia) atau `Public`
   - **⚠️ JANGAN centang** "Add a README file"
4. Klik **"Create repository"**

**Langkah 3: Hubungkan dengan Repository Lokal**

Setelah repository dibuat, jalankan perintah ini di Terminal:

```bash
cd /Users/dadangaziz/Desktop/cat-poltektrans-sdp-palembang

# Tambahkan remote GitHub (ganti USERNAME dengan username GitHub Anda)
git remote add origin https://github.com/USERNAME/cat-poltektrans-sdp-palembang.git

# Push ke GitHub
git branch -M main
git push -u origin main
```

Jika diminta login, masukkan:
- Username: username GitHub Anda
- Password: **Personal Access Token** (bukan password biasa!)

> **Cara buat Personal Access Token:**
> 1. Buka: https://github.com/settings/tokens
> 2. Klik "Generate new token (classic)"
> 3. Beri nama, centang "repo"
> 4. Klik "Generate token"
> 5. Copy token dan gunakan sebagai password

---

### 6.2 Deploy ke Vercel (GRATIS)

**Langkah 1: Buka Vercel**
1. Buka https://vercel.com
2. Klik **"Sign Up"** → Pilih **"Continue with GitHub"**
3. Authorize Vercel mengakses GitHub Anda

**Langkah 2: Import Project**
1. Di Dashboard, klik **"Add New..."** → **"Project"**
2. Pilih **"Import Git Repository"**
3. Cari `cat-poltektrans-sdp-palembang` → Klik **"Import"**

**Langkah 3: Konfigurasi**
1. Framework Preset: Vercel akan otomatis detect **Vite**
2. Build Command: Biarkan default (`npm run build`)
3. Output Directory: Biarkan default (`dist`)
4. Klik **"Deploy"**

**Langkah 4: Tunggu Deploy**
- Vercel akan build dan deploy (sekitar 1-2 menit)
- Setelah selesai, Anda dapat URL seperti: `https://cat-poltektrans-xxx.vercel.app`

**🎉 Selesai! Website sudah live!**

---

### 6.3 Deploy ke Netlify (Alternatif - GRATIS)

**Langkah 1: Buka Netlify**
1. Buka https://netlify.com
2. Klik **"Sign Up"** → Pilih **"GitHub"**

**Langkah 2: Import Project**
1. Klik **"Add new site"** → **"Import an existing project"**
2. Pilih **"GitHub"**
3. Authorize dan pilih repo `cat-poltektrans-sdp-palembang`

**Langkah 3: Konfigurasi Build**
1. Build command: `npm run build`
2. Publish directory: `dist`
3. Klik **"Deploy site"**

---

### 6.4 Custom Domain (Opsional)

**Di Vercel:**
1. Buka project di Dashboard
2. Klik **"Settings"** → **"Domains"**
3. Masukkan domain Anda (contoh: `cat.poltektrans.ac.id`)
4. Ikuti instruksi DNS:
   - Tambahkan CNAME record di DNS hosting
   - Name: `cat`
   - Value: `cname.vercel-dns.com`

**Di Netlify:**
1. Buka **"Site settings"** → **"Domain management"**
2. Klik **"Add custom domain"**
3. Ikuti instruksi DNS-nya

---

### 6.5 Cara Update Website

Setelah setup selesai, untuk update website:

```bash
# 1. Edit kode sesuai kebutuhan
# 2. Test lokal dengan: npm run dev
# 3. Commit perubahan:
git add -A
git commit -m "Deskripsi perubahan"

# 4. Push ke GitHub:
git push

# 5. 🎉 Tunggu 1-2 menit, website otomatis terupdate!
```

**Ringkasan Alur Update:**
```
Edit Kode → git add → git commit → git push → ✅ Website Live!
```

---

## 📊 Perbandingan Hosting

| Fitur | Shared Hosting | Vercel/Netlify |
|-------|---------------|----------------|
| Harga | Berbayar | **GRATIS** |
| Auto Deploy | ❌ Manual | ✅ Otomatis |
| SSL/HTTPS | Manual setup | ✅ Otomatis |
| CDN Global | ❌ Tidak | ✅ Ya |
| Kecepatan | Tergantung server | ⚡ Sangat cepat |
| Update | Upload manual | `git push` saja |

**Rekomendasi:** Gunakan **Vercel** untuk kemudahan dan performa terbaik!
