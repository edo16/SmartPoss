# SmartPOS

Aplikasi Point of Sale untuk pencatatan transaksi dan pemantauan operasional toko.

## Fitur
- Dashboard penjualan berdasarkan periode
- Pengelolaan produk dan stok
- Transaksi tunai dan QRIS
- Riwayat dan detail transaksi
- Pengelolaan refund
- Ringkasan produk terlaris dan stok menipis
- Pembaruan real-time dengan Socket.IO

## Teknologi
- HTML, CSS, JavaScript, Chart.js
- Node.js dan Express.js
- PostgreSQL dan Prisma
- Socket.IO

## Persyaratan
- Node.js dan npm
- PostgreSQL
- Browser modern

## Menjalankan secara lokal
1. Masuk ke direktori `backend` dan jalankan `npm install`.
2. Buat `.env` berdasarkan `.env.example`, lalu isi konfigurasi database dan JWT dengan nilai milik sendiri. Jangan menimpa `.env` yang sudah ada.
3. Siapkan database PostgreSQL.
4. Dari direktori `backend`, jalankan `npx prisma migrate deploy`.
5. Jalankan backend dengan `npm run dev`.
6. Di Terminal baru, dari root proyek jalankan `python3 -m http.server 8000 --directory frontend`.
7. Buka `http://localhost:8000`. Backend lokal menggunakan port `5000`.

Jika menjalankan seed, atur `SEED_DEFAULT_PASSWORD` dengan kata sandi sendiri minimal 12 karakter.

## Keamanan
Jangan unggah `.env`, kredensial, token, atau kata sandi. Tinjau konfigurasi sebelum deployment produksi.

## Status
Proyek portofolio untuk pengembangan aplikasi POS. Pengujian dan peninjauan keamanan tetap diperlukan sebelum penggunaan produksi.
# SmartPoss
