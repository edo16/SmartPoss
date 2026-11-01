# SmartPOS – Point of Sale Management System

**Language:** Bahasa Indonesia | [English](./README_ENG.md)

**Sales Management, Inventory Control & Business Performance Monitoring**



## 📌 Tentang Proyek

SmartPOS merupakan aplikasi Point of Sale (POS) berbasis web yang dirancang untuk membantu mengelola transaksi penjualan dan operasional bisnis secara terintegrasi. Aplikasi ini memiliki sepuluh menu utama, yaitu **Dashboard, Point of Sale, Inventory, Transactions, Customers, Expenses, Analytics, Prediksi, Recap, dan Settings**.

Fitur-fitur tersebut mendukung berbagai aktivitas operasional bisnis, mulai dari pencatatan transaksi penjualan, pengelolaan produk dan persediaan stok, pemantauan riwayat transaksi dan pengembalian dana (refund), pengelolaan data pelanggan, pencatatan pengeluaran operasional, analisis performa penjualan, estimasi pendapatan berdasarkan data historis, hingga penyusunan rekapitulasi laporan bisnis.

SmartPOS dikembangkan menggunakan **HTML, CSS, dan JavaScript** untuk membangun antarmuka pengguna, serta **Node.js dan Express.js** untuk menangani logika backend dan layanan API. Pengelolaan basis data menggunakan **Prisma ORM dan PostgreSQL**, sedangkan **Chart.js** digunakan untuk mendukung visualisasi data dan **Socket.IO** menyediakan kemampuan komunikasi real-time sesuai implementasi aplikasi. Selain itu, aplikasi ini dilengkapi dengan utilitas pelaporan dan pencadangan data untuk mendukung pengelolaan serta pemeliharaan sistem.

Proyek ini dikembangkan sebagai personal portfolio project untuk menerapkan keterampilan dalam pengembangan aplikasi web, pengelolaan basis data, pemrosesan transaksi, visualisasi data, dan analisis statistik guna mendukung operasional bisnis yang lebih efisien serta pengambilan keputusan berbasis data.

## 🎯 Tujuan Pengembangan

SmartPOS dikembangkan untuk menyediakan solusi digital yang terintegrasi dalam pengelolaan aktivitas operasional toko.

Tujuan utama pengembangan aplikasi ini meliputi:

- Mendigitalisasi proses pencatatan dan pengelolaan transaksi penjualan.
- Mempermudah pengelolaan produk, kategori, dan persediaan stok.
- Menyediakan dashboard informatif untuk memantau performa bisnis.
- Mempermudah pencarian dan pemeriksaan riwayat transaksi.
- Mendukung pencatatan serta pengelolaan proses pengembalian dana (refund).
- Mengelola informasi pelanggan dan pengeluaran operasional.
- Menyediakan analisis penjualan dan performa produk.
- Menghasilkan estimasi pendapatan berdasarkan data penjualan historis.
- Menyediakan rekapitulasi informasi operasional dan laporan bisnis.
- Mendukung pengelolaan konfigurasi serta pemeliharaan data aplikasi.
- Menyediakan komunikasi real-time untuk mendukung pembaruan informasi aplikasi.

## 🛠️ Tools & Technologies

| Teknologi | Penggunaan |
|---|---|
| HTML5 | Struktur halaman aplikasi |
| CSS3 | Desain dan tampilan antarmuka |
| JavaScript | Logika dan interaksi frontend |
| Chart.js | Visualisasi data dan grafik |
| Node.js | Runtime environment backend |
| Express.js | REST API dan pengelolaan server |
| PostgreSQL | Relational database |
| Prisma ORM | Database schema, migration, dan akses data |
| Socket.IO | Real-time communication |
| Python HTTP Server | Menjalankan frontend secara lokal |

## ⚙️ Modul dan Fitur Aplikasi

SmartPOS memiliki sepuluh menu utama yang saling mendukung dalam pengelolaan operasional bisnis.

### 1. Dashboard

Dashboard menyediakan ringkasan performa operasional dan keuangan toko berdasarkan periode laporan yang dipilih.

Informasi yang ditampilkan meliputi:

- **Total Revenue:** Total pendapatan penjualan.
- **Total Transactions:** Jumlah transaksi yang tercatat.
- **Average Transaction Value:** Rata-rata nilai transaksi.
- **Gross Profit:** Estimasi laba kotor.
- Perbandingan performa dengan periode sebelumnya.
- Grafik perkembangan penjualan berdasarkan tanggal.
- Riwayat transaksi terbaru.

Dashboard menyediakan pilihan periode laporan berupa Today, 7 Days, 30 Days, dan Custom Date Range untuk membantu pemantauan performa bisnis.

### 2. Point of Sale (POS)

Modul Point of Sale digunakan untuk memproses transaksi penjualan secara langsung melalui antarmuka kasir.

Fitur yang tersedia:

- Menampilkan daftar produk yang tersedia.
- Memilih produk untuk transaksi.
- Mengatur kuantitas produk.
- Menghitung total transaksi secara otomatis.
- Mendukung metode pembayaran Cash dan QRIS.
- Menyimpan transaksi ke dalam sistem.
- Mendukung pembaruan persediaan berdasarkan transaksi penjualan.

### 3. Inventory

Modul Inventory digunakan untuk mengelola informasi produk dan memantau ketersediaan persediaan barang.

Fitur yang tersedia:

- Menambahkan produk baru.
- Mengubah informasi produk.
- Mengelompokkan produk berdasarkan kategori.
- Memantau jumlah persediaan stok.
- Menghapus produk.
- Melihat produk yang telah dihapus melalui fitur Trash.
- Memulihkan produk dari daftar Trash.

### 4. Transactions

Modul Transactions digunakan untuk mencatat, menampilkan, dan memantau seluruh aktivitas transaksi penjualan.

Fitur yang tersedia:

- Menampilkan riwayat transaksi.
- Memantau metode pembayaran Cash dan QRIS.
- Menampilkan detail transaksi.
- Memantau status transaksi.
- Membedakan transaksi berdasarkan status penyelesaian.
- Menampilkan informasi refund yang berkaitan dengan transaksi.

**Refund Management**

Pengelolaan refund tersedia melalui detail transaksi dan mendukung proses pengembalian dana.

Fitur refund meliputi:

- Membuat permintaan refund.
- Melihat riwayat refund.
- Mendukung metode pengembalian dana tunai dan QRIS/transfer.
- Mengonfirmasi proses refund.
- Membatalkan permintaan refund.
- Memantau status refund: Pending, Completed, dan Cancelled.

### 5. Customers

Modul Customers digunakan untuk mengelola informasi pelanggan yang tersimpan dalam sistem.

Fitur yang tersedia:

- Menampilkan daftar pelanggan.
- Menambahkan data pelanggan.
- Mengubah informasi pelanggan.
- Mengelola data pelanggan yang tersimpan.
- Mempermudah pencarian dan pengelolaan informasi pelanggan.

### 6. Expenses

Modul Expenses digunakan untuk mencatat dan memantau pengeluaran operasional toko.

Fitur yang tersedia:

- Mencatat pengeluaran operasional.
- Mengelola informasi pengeluaran.
- Menampilkan riwayat pengeluaran.
- Memantau total pengeluaran berdasarkan periode.
- Mendukung pemantauan kondisi keuangan operasional.

### 7. Analytics

Modul Analytics menyediakan informasi analitis untuk membantu mengevaluasi performa penjualan dan aktivitas bisnis.

Analisis yang disajikan meliputi:

- Tren pendapatan penjualan.
- Perkembangan transaksi.
- Performa penjualan produk.
- Informasi produk dengan penjualan tertinggi.
- Indikator performa bisnis berdasarkan data operasional.

Visualisasi data digunakan untuk membantu memahami pola penjualan dan mendukung pengambilan keputusan berbasis data.

### 8. Prediksi

Modul Prediksi digunakan untuk menghasilkan estimasi pendapatan penjualan berdasarkan data historis menggunakan pendekatan statistik **Historical Median (Median Historis)**.

Proses perhitungan meliputi:

- Mengambil data penjualan historis.
- Mengidentifikasi hari dengan transaksi penjualan tercatat.
- Menghitung median pendapatan harian.
- Menggunakan nilai median sebagai dasar estimasi pendapatan.
- Menampilkan estimasi pendapatan untuk tujuh hari operasional berikutnya.
- Menampilkan informasi jumlah hari aktif yang digunakan dalam perhitungan.

Sistem juga memberikan pemberitahuan apabila jumlah data historis yang tersedia masih kurang dari 30 hari.

**Catatan:** Historical Median merupakan pendekatan statistik baseline. Hasil estimasi belum dapat dianggap memiliki tingkat akurasi tertentu sebelum dilakukan pengujian menggunakan data historis.

### 9. Recap

Modul Recap digunakan untuk menyajikan rekapitulasi informasi penjualan dan aktivitas operasional toko.

Fitur ini mendukung:

- Penyajian ringkasan data penjualan.
- Rekapitulasi transaksi berdasarkan periode.
- Pemantauan informasi operasional.
- Penyajian informasi untuk membantu evaluasi performa bisnis.

### 10. Settings

Modul Settings digunakan untuk mengelola konfigurasi dan pengaturan aplikasi.

Fitur yang tersedia mencakup:

- Pengelolaan profil dan informasi toko.
- Pengaturan sistem sesuai hak akses pengguna.
- Pengelolaan data operasional.
- Utilitas pencadangan dan pemulihan data sesuai implementasi aplikasi.

## 🔄 Application Development Process

Pengembangan SmartPOS dilakukan melalui beberapa tahapan untuk membangun aplikasi yang terintegrasi antara frontend, backend, dan database.

### 1. Application Design

Merancang struktur aplikasi berdasarkan kebutuhan operasional toko, termasuk perancangan dashboard, POS, inventory, transaksi, pelanggan, pengeluaran, analitik, prediksi, rekapitulasi, dan pengaturan aplikasi.

### 2. Frontend Development

Mengembangkan antarmuka pengguna menggunakan HTML, CSS, dan JavaScript dengan fokus pada:

- Struktur halaman dan navigasi aplikasi.
- Komponen dashboard dan visualisasi data.
- Tabel dan formulir pengelolaan data.
- Interaksi pengguna dan pemrosesan input.
- Integrasi data dari backend.
- Tampilan responsif untuk desktop dan perangkat mobile.

### 3. Backend Development

Mengembangkan backend menggunakan Node.js dan Express.js untuk menangani:

- REST API.
- Autentikasi dan otorisasi.
- Pengelolaan data produk dan pelanggan.
- Pemrosesan transaksi penjualan.
- Pengelolaan refund.
- Pencatatan pengeluaran.
- Pengambilan data dashboard dan analitik.
- Komunikasi real-time.

### 4. Database Management

Menggunakan PostgreSQL sebagai relational database dan Prisma ORM untuk pengelolaan struktur serta akses data.

Pengelolaan database mencakup:

- Perancangan database schema.
- Relasi antarentitas.
- Database migration.
- Operasi Create, Read, Update, dan Delete (CRUD).
- Pengelolaan data produk, pelanggan, transaksi, dan refund.

### 5. Real-Time Integration

Mengintegrasikan Socket.IO untuk mendukung komunikasi antara frontend dan backend sehingga pembaruan informasi dapat disampaikan secara real-time sesuai implementasi aplikasi.

### 6. Testing & Validation

Melakukan pemeriksaan dan pengujian terhadap implementasi aplikasi, meliputi:

- Validasi sintaks program.
- Pengujian endpoint API.
- Pemeriksaan integrasi frontend dan backend.
- Pengujian alur transaksi penjualan.
- Pemeriksaan pengelolaan inventory dan refund.
- Validasi fungsi-fungsi utama aplikasi.

## 📊 Dashboard & Application Interface

Dokumentasi berikut menampilkan antarmuka dari sepuluh menu utama SmartPOS. Screenshot digunakan untuk memperlihatkan implementasi fitur dan tampilan aplikasi.

### 1. Dashboard

Menampilkan ringkasan performa penjualan, indikator keuangan, perbandingan periode, grafik penjualan, dan aktivitas transaksi terbaru.

![Dashboard Overview](Images/dashboard.png)

### 2. Point of Sale (POS)

Menampilkan antarmuka kasir untuk memilih produk, mengatur kuantitas, menghitung total transaksi, dan memproses pembayaran.

![Point of Sale](Images/pos.png)

### 3. Inventory

Menampilkan daftar produk, kategori, informasi persediaan stok, serta pengelolaan produk melalui fitur Inventory dan Trash.

![Inventory Management](Images/inventory.png)

### 4. Transactions

Menampilkan riwayat transaksi, metode pembayaran, status transaksi, serta detail penjualan dan informasi pengembalian dana.

![Transaction Management](Images/transactions.png)

### 5. Customers

Menampilkan daftar dan informasi pelanggan yang dikelola melalui sistem.

![Customer Management](Images/customers.png)

### 6. Expenses

Menampilkan pencatatan pengeluaran operasional dan ringkasan pengeluaran toko.

![Expense Management](Images/expenses.png)

### 7. Analytics

Menampilkan visualisasi dan analisis performa penjualan untuk membantu evaluasi bisnis.

![Business Analytics](Images/analytics.png)

### 8. Prediksi

Menampilkan estimasi pendapatan berdasarkan pendekatan Historical Median menggunakan data penjualan historis.

![Sales Prediction](Images/prediction.png)

### 9. Recap

Menampilkan rekapitulasi data penjualan dan informasi operasional berdasarkan periode laporan.

![Business Recap](Images/recap.png)

### 10. Settings

Menampilkan halaman pengaturan aplikasi untuk pengelolaan profil toko, konfigurasi, dan utilitas pengelolaan data.

![Application Settings](Images/settings.png)


## 📂 Project Structure

Berikut merupakan gambaran struktur direktori utama SmartPOS:

```text
smartpos/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── lib/
│   │   └── server.js
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── css/
│   ├── js/
│   └── index.html
│
├── images/
│   ├── dashboard.png
│   ├── pos.png
│   ├── inventory.png
│   ├── transactions.png
│   ├── customers.png
│   ├── expenses.png
│   ├── analytics.png
│   ├── prediction.png
│   ├── recap.png
│   └── settings.png
│
├── README.md
└── ...
```

*Struktur di atas merupakan gambaran direktori utama dan dapat menyesuaikan implementasi aktual pada repository.*
