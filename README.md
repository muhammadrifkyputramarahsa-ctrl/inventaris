# 📦 Inventori Toko

Aplikasi web manajemen inventori (Kategori \& Produk) — Proyek Akhir Magang SMK.

## Fitur

* **Autentikasi**: Register, Login, Logout (password di-hash dengan bcrypt, proteksi CSRF, session aman)
* **RBAC**: `admin` (CRUD penuh) dan `user` (hanya melihat data \& dashboard)
* **CRUD berelasi**: Kategori ↔ Produk (satu kategori memiliki banyak produk)
* **Dashboard**: total produk, kategori, stok, nilai inventori, grafik produk per kategori, daftar stok menipis
* **Responsif**: Tailwind CSS, nyaman di mobile \& desktop

## Tech Stack

Node.js, Express, EJS, SQLite (better-sqlite3), Tailwind CSS (CDN)

## Instalasi Lokal

1. Pastikan **Node.js ≥ 18** terpasang.
2. Clone repository lalu masuk ke foldernya:

```bash
   git clone <url-repo-anda>
   cd inventori-toko
   ```

3. Pasang dependensi:

```bash
   npm install
   ```

4. Salin konfigurasi lingkungan lalu isi nilainya:

```bash
   cp .env.example .env
   ```

|Variabel|Keterangan|
|-|-|
|`PORT`|Port server (default 3000)|
|`SESSION\\\_SECRET`|String acak panjang untuk menandatangani session|
|`ADMIN\\\_NAME`, `ADMIN\\\_EMAIL`, `ADMIN\\\_PASSWORD`|Akun admin pertama (dibuat otomatis saat pertama kali dijalankan)|

5. Jalankan:

```bash
   npm start
   ```

6. Buka http://localhost:3000 dan login memakai akun admin dari `.env`.

> Database `data.sqlite` dibuat otomatis. File `.env` dan database \\\*\\\*tidak\\\*\\\* ikut ke GitHub (lihat `.gitignore`).

## Hak Akses

|Aksi|Admin|User|
|-|:-:|:-:|
|Lihat dashboard, kategori, produk|✅|✅|
|Tambah / ubah / hapus kategori \& produk|✅|❌|

Pendaftaran publik selalu menghasilkan role `user`.

## Struktur Proyek

```
server.js   # route, middleware auth/RBAC/CSRF
db.js       # skema database \\\& seed admin
views/      # template EJS (+ partials)
```

