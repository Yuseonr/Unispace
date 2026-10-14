<p align="center">
  <img src="unispace-frontend/public/Unispace_Logo_Trademark.svg" alt="Banner Unispace" width="360">
</p>

**Aplikasi web untuk reservasi dan pelaporan fasilitas kampus.**

Tugas Proyek PPK 2026, kelas C, kelompok 02. Unispace menyatukan katalog ruang dan alat, jadwal ketersediaan, persetujuan reservasi, laporan kerusakan, perbaikan, serta rekap operasional dalam satu aplikasi berbasis peran.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js 24 LTS](https://img.shields.io/badge/Node.js-24_LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/en/download)
[![Next.js 16.3.4](https://img.shields.io/badge/Next.js-16.3.4-000000?logo=nextdotjs&logoColor=white)](unispace-frontend/package.json)
[![React 19.2.8](https://img.shields.io/badge/React-19.2.8-149ECA?logo=react&logoColor=white)](unispace-frontend/package.json)
[![NestJS 12](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)](unispace-backend/package.json)
[![Prisma 7](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](unispace-backend/prisma/schema.prisma)
[![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)](docker-compose.yml)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)

## Tentang proyek dan pembuat

Informasi ketersediaan fasilitas yang tersebar membuat peminjam sulit memilih jadwal, petugas sulit melacak pengajuan, dan fasilitas bermasalah berisiko tetap dipesan. Unispace menyediakan katalog dan jadwal bersama, pemeriksaan bentrok saat persetujuan, serta hubungan langsung antara laporan, periode perbaikan, dan reservasi terdampak.

| Informasi | Keterangan |
|---|---|
| Nama proyek | Unispace |
| Konteks | Tugas Proyek PPK 2026 C, kelompok 02 |
| Repository | [Yuseonr/Unispace](https://github.com/Yuseonr/Unispace) |
| Spesifikasi produk | [docs/PRD.md](docs/PRD.md) |
| Pengguna sasaran | Mahasiswa, dosen, staf kampus, petugas operasional, dan admin |

Pembuat proyek:

| Nama | NIM |
|---|---|
| Rafi Anandra Dharmawan | 24060124130071 |
| Rio Setiawan Hastanu Putra | 24060124130068 |
| Adefritz Einar Sinaga | 24060124140186 |
| Yuma Hazza Yuditama | 24060124120035 |

## Fitur dan hak akses

| Aktor | Fitur utama | Halaman utama |
|---|---|---|
| Pengunjung | Cari dan filter fasilitas, lihat detail dan ketersediaan tanpa data pribadi pemesan, registrasi, login | `/`, `/facilities`, `/facilities/:id`, `/register`, `/login` |
| Pengguna (`USER`) | Ajukan reservasi ruang atau alat, lihat riwayat dan kode aset, batalkan reservasi sendiri, kirim laporan dengan foto, ubah kata sandi | `/reservations`, `/reservations/new`, `/reports`, `/reports/new`, `/profile` |
| Petugas (`STAFF`) | Setujui/tolak/batalkan reservasi, tangani laporan, lihat katalog operasional, jadwalkan dan akhiri perbaikan | `/staff/reservations`, `/staff/reports`, `/staff/facilities`, `/staff/maintenance`, `/staff/profile` |
| Admin (`ADMIN`) | Verifikasi registrasi, kelola akun dan kata sandi awal, master tipe/area, kelompok/unit fasilitas dan foto, dashboard, rekap CSV/XLSX/PDF, audit log | `/admin`, `/admin/accounts`, `/admin/accounts/verification`, `/admin/facilities`, `/admin/analytics`, `/admin/audit-logs` |

Admin mengelola data dan rekap. Keputusan reservasi, penanganan laporan, serta perbaikan merupakan kewenangan petugas. Akun petugas dibuat admin. Seluruh peran yang sudah login dapat mengganti kata sandi melalui Profil dengan memasukkan kata sandi lama.

Dua mode reservasi tersedia:

| Mode | Contoh | Cara reservasi |
|---|---|---|
| `EXCLUSIVE` | Ruang kelas, aula, laboratorium, ruang rapat, area | Pilih satu unit fasilitas dan slot waktu. Satu unit hanya dapat memiliki satu reservasi disetujui pada waktu yang sama. |
| `QUANTITY` | Proyektor, mikroskop, alat praktikum sejenis | Pilih kelompok alat, slot, dan jumlah unit. Saat disetujui, backend mengalokasikan unit fisik yang bebas sepanjang rentang waktu. |

Nama, tipe, area, lokasi detail, kapasitas, deskripsi, dan foto alat bergerak dikelola pada kelompoknya. Setiap unit alat memiliki kode aset unik untuk alokasi dan pelaporan kerusakan. Peralatan tetap di ruang, misalnya AC, dilaporkan melalui ruang induknya.

## Asumsi dan aturan bisnis

Aturan lengkap ada pada [PRD bagian 7](docs/PRD.md#7-aturan-bisnis). Ringkasan berikut membantu memahami perilaku aplikasi saat mencoba demo.

| Topik | Aturan |
|---|---|
| Zona waktu | `Asia/Jakarta` atau WIB. |
| Operasional | Senin sampai Jumat, pukul 07.00 sampai 20.00. Hari libur dan penutupan tanggal khusus belum dikelola. |
| Slot | Kelipatan 30 menit, berurutan, dalam satu tanggal. Tidak ada batas durasi tambahan di luar jam operasional. |
| Batas pengajuan | Paling lambat H-2 hari operasional; tanggal penggunaan paling jauh 14 hari kalender sejak pengajuan. Pengajuan boleh dikirim di luar jam operasional. |
| H-1/H-2 | Dihitung dengan melewati Sabtu dan Minggu. Untuk penggunaan Senin, H-1 adalah Jumat dan H-2 adalah Kamis sebelumnya. |
| Tenggat keputusan | Pukul 20.00 hari operasional berikutnya setelah pengajuan atau pukul 20.00 H-1 penggunaan, dipilih yang lebih awal. Scheduler memeriksa pengajuan kedaluwarsa setiap menit dan menolaknya. |
| Tujuan peminjaman | Wajib, dipangkas dari spasi awal/akhir, tidak boleh kosong, maksimum 500 karakter. |
| Target pengajuan | Tepat satu ruang/area atau satu kelompok alat. Kebutuhan ruang dan alat diajukan terpisah. |
| Antrean menunggu | `PENDING` dapat tumpang tindih dan belum mengurangi ketersediaan. Persetujuan memeriksa ulang bentrok/stok secara atomik. Pengajuan menunggu yang tidak lagi dapat dipenuhi langsung ditolak. |
| Pembatalan pengguna | Reservasi sendiri berstatus `PENDING` atau `APPROVED`, paling lambat pukul 20.00 H-1 hari operasional. |
| Keputusan petugas | Penolakan dan pembatalan wajib disertai alasan yang dapat dibaca pengguna. Tidak ada prioritas otomatis berdasarkan urutan pengajuan. |
| Registrasi | Nama, NIM/NIP 8 sampai 30 digit, email, dan kata sandi wajib. NIM/NIP dan email unik. Registrasi masuk `PENDING_VERIFICATION` hingga admin menyetujui. |
| Kata sandi | 12 sampai 24 karakter dan tidak boleh hanya berisi spasi. Spasi tidak dipangkas atau diubah. Akun yang dibuat/reset admin memakai `DEFAULT_USER_PASSWORD`. |
| Foto laporan | Wajib 1 sampai 3 foto JPEG, PNG, atau WebP, maksimal 5 MB per foto. Foto utama katalog juga menggunakan object storage. |
| Perbaikan | Dibuat petugas dari laporan `IN_PROGRESS` atau secara mandiri. Pilih rentang tanggal penuh atau satu tanggal dengan rentang jam pada batas slot. |
| Dampak perbaikan | Backend menampilkan reservasi disetujui yang bertabrakan. Petugas mengonfirmasi pembatalan massal dengan satu alasan. Stok dan pengajuan menunggu dihitung ulang. |
| Penyelesaian laporan | Wajib catatan resolusi. Laporan belum dapat selesai selama ada periode perbaikan terkait yang aktif/terjadwal. Antrean laporan dapat dilanjutkan petugas mana pun. |
| Status fasilitas | `NONACTIVE` disembunyikan dari katalog dan memiliki prioritas tertinggi. Perbaikan mendatang memblokir slot terkait; status `IN_MAINTENANCE` berlaku saat periodenya berlangsung. Perbaikan dapat diakhiri lebih awal. |
| Histori | Akun/fasilitas dinonaktifkan untuk menjaga histori. Admin tidak dapat menonaktifkan fasilitas yang masih memiliki reservasi disetujui belum selesai. |

Okupansi ruang menghitung slot terpakai dari reservasi `APPROVED`/`COMPLETED` dibanding slot operasional dalam periode. Utilisasi alat memakai unit-slot. Maintenance tetap masuk pembagi; slot sejak fasilitas nonaktif dikeluarkan. Frekuensi kerusakan menghitung laporan `NEW`/`IN_PROGRESS`/`RESOLVED` berdasarkan waktu laporan dibuat, tanpa laporan `REJECTED`.

Baseline belum mencakup pembayaran, reservasi berulang/multi-hari, SSO, email/WhatsApp/push otomatis, aplikasi mobile native, QR check-in, kalender eksternal, serta alur pengambilan/pengembalian alat yang terpisah. Verifikasi identitas dilakukan manual oleh admin.

## Teknologi yang digunakan

<p align="center">
  <a href="https://nodejs.org"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" alt="Node.js" width="48" height="48"></a>
  <a href="https://nextjs.org"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg" alt="Next.js" width="48" height="48"></a>
  <a href="https://react.dev"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" alt="React" width="48" height="48"></a>
  <a href="https://www.typescriptlang.org"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" alt="TypeScript" width="48" height="48"></a>
  <a href="https://tailwindcss.com"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg" alt="Tailwind CSS" width="48" height="48"></a>
  <a href="https://nestjs.com"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nestjs/nestjs-original.svg" alt="NestJS" width="48" height="48"></a>
  <a href="https://www.prisma.io"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/prisma/prisma-original.svg" alt="Prisma" width="48" height="48"></a>
  <a href="https://www.postgresql.org"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg" alt="PostgreSQL" width="48" height="48"></a>
  <a href="https://www.docker.com"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg" alt="Docker" width="48" height="48"></a>
</p>

| Teknologi | Versi/acuan proyek | Peran |
|---|---|---|
| [![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/docs) | `16.3.4` | App Router, halaman publik, portal pengguna/petugas/admin, rewrite API saat deployment. |
| [![React](https://img.shields.io/badge/React-149ECA?logo=react&logoColor=white)](https://react.dev) | `19.2.8` | Komponen dan interaksi antarmuka. |
| [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/docs/) | Frontend `^5`, backend `^6.0.2` | Tipe data frontend dan backend. |
| [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/docs) | `4.x` | Styling antarmuka. |
| [![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://docs.nestjs.com) | `12.x` | REST API, modul domain, autentikasi, validasi, guard peran, scheduler. |
| [![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/docs) | `7.x` | Schema, migrasi SQL, client database dengan adapter PostgreSQL. |
| [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/docs/18/) | `18-alpine` pada Compose | Akun, katalog, reservasi, laporan, histori, audit, dan idempotensi. |
| [![MinIO](https://img.shields.io/badge/MinIO-C72E49?logo=minio&logoColor=white)](https://docs.min.io/aistor/installation/container/) | AIStor `RELEASE.2026-08-07T18-34-35Z` | Object storage S3 untuk foto lokal, membutuhkan lisensi. |
| [![S3 API](https://img.shields.io/badge/Storage-S3_API-569A31)](unispace-backend/src/common/storage/object-storage.service.ts) | AWS SDK for JavaScript `3.x` | Akses object storage; mendukung MinIO dan bucket S3 kompatibel. |
| [![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/) | Docker Engine/Desktop dan Compose v2 | Menjalankan PostgreSQL, MinIO, dan inisialisasi bucket. |
| [![JWT](https://img.shields.io/badge/Auth-JWT_%2B_bcrypt-5B21B6)](unispace-backend/src/accounts/auth/auth.service.ts) | `@nestjs/jwt`, bcrypt `6.x` | Access token, rotasi refresh token dalam cookie HttpOnly, hash kata sandi. |
| [![Ekspor](https://img.shields.io/badge/Export-CSV_%7C_XLSX_%7C_PDF-0F766E)](unispace-backend/src/analytics/analytics-export.service.ts) | ExcelJS `4.x`, PDFKit `0.20.x` | Rekap sesuai filter admin. |
| [![Jest](https://img.shields.io/badge/Jest-C21325?logo=jest&logoColor=white)](unispace-backend/package.json) | Jest `30.x`, Supertest `7.x` | Test backend yang tersedia di repository. |
| [![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/docs) / [![Railway](https://img.shields.io/badge/Railway-0B0D0E?logo=railway&logoColor=white)](https://docs.railway.com) | Target deployment | Frontend di Vercel; API, database, dan bucket di Railway. |

Versi dependency mengikuti [package frontend](unispace-frontend/package.json), [package backend](unispace-backend/package.json), dan masing-masing `package-lock.json`. Logo teknologi dimuat dari Devicon; badge dimuat dari Shields.io dan membutuhkan koneksi internet.

## Arsitektur dan alur singkat

![Arsitektur client, frontend Next.js, backend NestJS dan Prisma, object storage, serta PostgreSQL](docs/arsitektur-sistem.png)

Gambar memperlihatkan komunikasi HTTPS saat deployment. Pada lokal, frontend dan backend memakai HTTP `localhost`. Backend menyimpan data terstruktur di PostgreSQL dan foto di bucket private. Foto fasilitas disajikan melalui API; akses foto laporan diperiksa berdasarkan autentikasi dan hak akses.

```mermaid
flowchart LR
    browser["Browser pengguna"] --> frontend["Next.js dan React"]
    frontend -->|"REST API /api/v1"| backend["NestJS: auth, katalog, reservasi, laporan, rekap"]
    backend --> prisma["Prisma dan adapter pg"]
    prisma --> database["PostgreSQL"]
    backend -->|"AWS SDK S3"| storage["MinIO lokal atau bucket S3"]
    scheduler["Nest scheduler setiap menit"] --> backend
```

### Registrasi dan reservasi

```mermaid
flowchart TD
    catalog["Cari fasilitas dan lihat slot"] --> account{"Akun aktif?"}
    account -->|"Belum"| register["Registrasi sebagai USER"]
    register --> verification["Admin memverifikasi akun"]
    verification --> login["Login"]
    account -->|"Ya"| login
    login --> request["Pilih tanggal, slot, tujuan, dan jumlah alat bila diperlukan"]
    request --> validate["Backend memvalidasi target, H-2, waktu, dan ketersediaan"]
    validate --> pending["PENDING"]
    pending --> decision{"Keputusan petugas"}
    decision -->|"Setujui"| stock["Periksa ulang bentrok dan alokasikan aset dalam transaksi"]
    stock --> approved["APPROVED"]
    decision -->|"Tolak dengan alasan"| rejected["REJECTED"]
    pending -->|"Tenggat terlewati"| rejected
    approved -->|"Waktu penggunaan berakhir"| completed["COMPLETED"]
    pending -->|"Pengguna membatalkan sebelum batas H-1"| userCancel["CANCELLED_BY_USER"]
    approved -->|"Pengguna membatalkan sebelum batas H-1"| userCancel
    approved -->|"Petugas membatalkan dengan alasan"| staffCancel["CANCELLED_BY_STAFF"]
    approved -->|"Akun dinonaktifkan"| systemCancel["CANCELLED_BY_SYSTEM"]
```

Status akhir `REJECTED` juga dapat muncul karena persetujuan pengajuan lain, perubahan ketersediaan, atau penonaktifan. Persetujuan ruang memakai proteksi bentrok di database; persetujuan alat memakai transaksi dan penguncian aset. Hal ini menjaga ketersediaan ketika beberapa petugas mengambil keputusan bersamaan.

### Laporan dan perbaikan

```mermaid
flowchart TD
    report["Pengguna memilih unit aset dan mengirim deskripsi serta foto"] --> newReport["NEW"]
    newReport --> assessment{"Petugas mengevaluasi"}
    assessment -->|"Tolak dengan alasan"| rejectedReport["REJECTED"]
    assessment -->|"Terima"| progress["IN_PROGRESS"]
    progress --> needsRepair{"Perlu periode perbaikan?"}
    needsRepair -->|"Ya"| preview["Pilih periode dan lihat reservasi terdampak"]
    direct["Petugas membuat perbaikan mandiri"] --> preview
    preview --> confirmation["Konfirmasi dampak dan alasan pembatalan bila diperlukan"]
    confirmation --> blocked["Blokir slot, batalkan reservasi terdampak, hitung ulang stok"]
    blocked --> repairEnd["Periode berakhir atau diakhiri lebih awal"]
    repairEnd --> resolved["Laporan terkait diselesaikan dengan catatan resolusi"]
    needsRepair -->|"Tidak"| resolved
```

Perbaikan mandiri tidak memiliki laporan terkait. Menutup periode tidak otomatis menyelesaikan laporan; petugas tetap mengisi catatan resolusi. Perubahan penting disimpan pada audit log.

## Tampilan aplikasi

Screenshot berikut berasal dari aset yang disediakan di `docs`, dengan nama file sesuai fungsi halaman. Angka, tanggal, dan isi contoh pada gambar menggambarkan kondisi saat screenshot dibuat dan dapat berbeda dari hasil seed baru.

### Beranda dan katalog publik

Pengunjung mencari fasilitas berdasarkan teks, tipe, area kampus, dan kapasitas, lalu melihat jadwal tanpa identitas pemesan.

| Beranda | Katalog fasilitas |
|---|---|
| <img src="docs/beranda.png" alt="Beranda Unispace dengan fasilitas pilihan" width="480"> | <img src="docs/katalog-fasilitas.png" alt="Katalog fasilitas dengan pencarian, filter, dan kondisi fasilitas" width="480"> |

### Login dan registrasi

Registrasi menggunakan nama, NIM/NIP, email, serta kata sandi. Akun baru menunggu verifikasi admin sebelum login.

| Login | Registrasi |
|---|---|
| <img src="docs/login.png" alt="Form login Unispace" width="480"> | <img src="docs/registrasi.png" alt="Form registrasi Unispace" width="480"> |

### Reservasi dan laporan pengguna

Riwayat reservasi menampilkan jadwal, tujuan, status, alasan keputusan, serta kode aset yang dialokasikan. Form laporan menerima bukti foto dan pilihan unit fasilitas.

| Reservasi saya | Form laporan |
|---|---|
| <img src="docs/pengguna-reservasi-saya.png" alt="Reservasi pengguna dengan status dan detail aset" width="480"> | <img src="docs/pengguna-form-laporan.png" alt="Form laporan kendala beserta unggahan foto" width="480"> |

### Portal petugas dan admin

Antrean reservasi menyediakan filter, batas keputusan, rincian pengajuan, dan tindakan persetujuan/penolakan. Portal petugas juga menyediakan laporan kendala dan jadwal perbaikan.

Dashboard memperlihatkan ringkasan reservasi, penggunaan fasilitas, laporan, okupansi ruang, dan utilisasi alat.

| Antrean reservasi petugas | Dashboard admin |
|---|---|
| <img src="docs/petugas-antrean-reservasi.png" alt="Antrean reservasi petugas dengan batas SLA dan tindakan" width="480"> | <img src="docs/admin-dashboard.png" alt="Dashboard admin Unispace" width="480"> |

<details>
<summary>Lihat manajemen dan editor fasilitas</summary>

Admin mengelola ruang eksklusif serta kelompok alat beserta unit asetnya.

| Manajemen fasilitas | Editor fasilitas |
|---|---|
| <img src="docs/admin-manajemen-fasilitas.png" alt="Daftar fasilitas pada portal admin" width="480"> | <img src="docs/admin-editor-fasilitas.png" alt="Editor fasilitas dengan foto, area, lokasi, dan kapasitas" width="480"> |

</details>

<details>
<summary>Lihat contoh hasil ekspor PDF</summary>

Ekspor memuat periode, waktu pembuatan, dan rekap operasional sesuai filter. Format CSV dan XLSX juga tersedia.

<img src="docs/ekspor-rekap-pdf.png" alt="Hasil ekspor rekap operasional Unispace dalam PDF" width="480">

</details>

## Struktur repository

```text
Unispace/
├── README.md                 # Dokumentasi utama, ERD, dan seluruh endpoint API
├── LICENSE                   # Lisensi MIT
├── .gitignore                # Mengabaikan dependency, build, env, dan lisensi lokal
├── .env.example              # Contoh konfigurasi PostgreSQL dan MinIO untuk Compose
├── docker-compose.yml        # Service postgres, minio, dan minio-init
├── docs/
│   ├── PRD.md                # Kebutuhan produk, aturan bisnis, dan hak akses
│   └── *.png                 # Gambar arsitektur dan screenshot tiap peran
├── unispace-backend/          # REST API, aturan bisnis, database, storage, dan rekap
└── unispace-frontend/         # Halaman, komponen, sesi pengguna, dan HTTP client
```

<details>
<summary><strong>Struktur backend lengkap</strong></summary>

```text
unispace-backend/
├── src/
│   ├── accounts/  # Autentikasi dan manajemen akun
│   │   ├── auth/  # Login, refresh, logout, registrasi, password
│   │   │   ├── decorators/  # Public, CurrentUser, dan Roles
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   ├── public.decorator.ts
│   │   │   │   └── roles.decorator.ts
│   │   │   ├── dto/  # DTO dan validasi input
│   │   │   │   ├── change-password.dto.ts
│   │   │   │   ├── login.dto.ts
│   │   │   │   └── register.dto.ts
│   │   │   ├── guards/  # Proteksi token dan role
│   │   │   │   ├── jwt-auth.guard.ts  # Validasi access token dan akun aktif
│   │   │   │   ├── roles.guard.spec.ts  # Test unit
│   │   │   │   └── roles.guard.ts  # Pembatasan role endpoint
│   │   │   ├── auth.constants.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.spec.ts  # Test unit
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.types.ts
│   │   │   ├── password.constants.ts
│   │   │   └── password.service.ts  # Hash dan verifikasi password bcrypt
│   │   ├── users/  # Akun dan verifikasi oleh admin
│   │   │   ├── dto/  # DTO dan validasi input
│   │   │   │   ├── create-managed-user.dto.ts
│   │   │   │   ├── list-managed-users.dto.ts
│   │   │   │   ├── reject-verification.dto.ts
│   │   │   │   └── update-managed-user-status.dto.ts
│   │   │   ├── admin-users.controller.ts
│   │   │   ├── admin-users.service.spec.ts  # Test unit
│   │   │   └── admin-users.service.ts
│   │   └── accounts.module.ts  # Modul akun dan guard global
│   ├── analytics/  # Dashboard admin, rekap, ekspor, audit
│   │   ├── assets/  # SVG untuk dokumen ekspor
│   │   │   ├── unispace-brand.svg
│   │   │   └── unispace-logo.svg
│   │   ├── dto/  # DTO dan validasi input
│   │   │   ├── analytics-export.dto.ts
│   │   │   ├── analytics-filter.dto.ts
│   │   │   ├── analytics-trend.dto.ts
│   │   │   ├── facility-report-history.dto.ts
│   │   │   ├── index.ts
│   │   │   └── list-audit-logs.dto.ts
│   │   ├── admin-audit-logs.controller.ts
│   │   ├── analytics-export.service.spec.ts  # Test unit
│   │   ├── analytics-export.service.ts
│   │   ├── analytics-query.service.spec.ts  # Test unit
│   │   ├── analytics-query.service.ts
│   │   ├── analytics.controller.ts
│   │   ├── analytics.module.ts
│   │   └── audit-log.service.ts
│   ├── common/  # Utilitas yang dipakai lintas domain
│   │   ├── http/
│   │   │   ├── api-response.interceptor.ts  # Envelope respons sukses
│   │   │   ├── http-exception.filter.spec.ts  # Test unit
│   │   │   ├── http-exception.filter.ts  # Format respons error
│   │   │   └── response-metadata.ts  # Request ID dan waktu respons
│   │   ├── idempotency/
│   │   │   └── idempotency.service.ts  # Pencegahan mutasi berulang dengan key
│   │   ├── storage/
│   │   │   ├── image-upload.validation.ts  # Validasi ukuran, MIME, dan isi foto
│   │   │   └── object-storage.service.ts  # Foto laporan di object storage S3
│   │   └── time/
│   │       └── jakarta-reservation-boundary.util.ts  # Batas tanggal/jam reservasi dalam WIB
│   ├── config/
│   │   └── env.validation.ts  # Validasi environment saat startup
│   ├── database/
│   │   ├── prisma.module.ts  # Penyedia PrismaService global
│   │   └── prisma.service.ts  # Koneksi Prisma melalui adapter pg
│   ├── facilities/  # Katalog, master fasilitas, dan perbaikan
│   │   ├── admin/  # Service CRUD master, grup, unit, dan status
│   │   │   ├── facility-management.service.ts
│   │   │   ├── facility-master.service.ts
│   │   │   └── facility-status.service.ts
│   │   ├── catalog/  # Service katalog publik dan slot ketersediaan
│   │   │   ├── facility-availability.service.ts
│   │   │   └── facility-catalog.service.ts
│   │   ├── dto/  # DTO dan validasi input
│   │   │   ├── admin/  # Kontrak input pengelolaan fasilitas
│   │   │   │   ├── facility-area.dto.ts
│   │   │   │   ├── facility-group.dto.ts
│   │   │   │   ├── facility-type.dto.ts
│   │   │   │   ├── facility-unit.dto.ts
│   │   │   │   └── index.ts
│   │   │   ├── catalog/  # Filter katalog dan query slot
│   │   │   │   ├── index.ts
│   │   │   │   ├── query-availability.dto.ts
│   │   │   │   └── query-facilities.dto.ts
│   │   │   ├── staff/  # Filter jadwal perbaikan petugas
│   │   │   │   └── list-staff-maintenance.dto.ts
│   │   │   ├── create-direct-maintenance.dto.spec.ts  # Test unit
│   │   │   ├── create-direct-maintenance.dto.ts
│   │   │   ├── maintenance-window.dto.ts
│   │   │   ├── preview-direct-maintenance.dto.spec.ts  # Test unit
│   │   │   └── preview-direct-maintenance.dto.ts
│   │   ├── utils/  # Perhitungan slot dan waktu Jakarta
│   │   │   ├── availability-slot.util.spec.ts  # Test unit
│   │   │   ├── availability-slot.util.ts
│   │   │   ├── jakarta-time.util.spec.ts  # Test unit
│   │   │   └── jakarta-time.util.ts
│   │   ├── admin-facilities.controller.ts
│   │   ├── facilities.controller.ts
│   │   ├── facilities.module.ts
│   │   ├── facilities.service.spec.ts  # Test unit
│   │   ├── facility-image-storage.service.spec.ts  # Test unit
│   │   ├── facility-image-storage.service.ts  # Upload dan proxy foto utama fasilitas
│   │   ├── facility-image-upload.interceptor.ts
│   │   ├── facility-images.controller.ts
│   │   ├── maintenance-workflow.service.spec.ts  # Test unit
│   │   ├── maintenance-workflow.service.ts  # Preview dan penerapan dampak perbaikan
│   │   ├── maintenance.constants.ts
│   │   ├── quantity-reservation-reconciliation.service.ts  # Penguncian ketersediaan dan rekonsiliasi stok
│   │   ├── staff-facilities.controller.ts
│   │   ├── staff-facilities.service.ts
│   │   └── staff-maintenance.service.ts
│   ├── health/  # Liveness dan readiness
│   │   ├── health.controller.ts
│   │   ├── health.module.ts
│   │   └── health.service.ts
│   ├── reports/  # Laporan, foto, perbaikan, dashboard petugas
│   │   ├── dto/  # DTO dan validasi input
│   │   │   ├── confirm-maintenance-period.dto.ts
│   │   │   ├── create-maintenance-period.dto.ts
│   │   │   ├── create-report.dto.ts
│   │   │   ├── index.ts
│   │   │   ├── list-my-reports.dto.ts
│   │   │   ├── list-report-audit.dto.ts
│   │   │   ├── list-reportable-facilities.dto.ts
│   │   │   ├── list-staff-reports.dto.ts
│   │   │   ├── maintenance-window.dto.ts
│   │   │   ├── preview-maintenance-impact.dto.ts
│   │   │   ├── reject-report.dto.ts
│   │   │   └── resolve-report.dto.ts
│   │   ├── report-photo-upload.interceptor.ts
│   │   ├── reports.constants.ts
│   │   ├── reports.controller.ts
│   │   ├── reports.module.ts
│   │   ├── reports.service.spec.ts  # Test unit
│   │   ├── reports.service.ts
│   │   ├── reports.types.ts
│   │   ├── staff-dashboard.controller.ts
│   │   ├── staff-dashboard.service.ts
│   │   └── staff-reports.controller.ts
│   ├── reservations/  # Reservasi pengguna/petugas dan alokasi
│   │   ├── dto/  # DTO dan validasi input
│   │   │   ├── approve-reservation.dto.ts
│   │   │   ├── cancel-staff-reservation.dto.ts
│   │   │   ├── create-reservation.dto.ts
│   │   │   ├── get-availability.dto.ts
│   │   │   ├── index.ts
│   │   │   ├── list-my-reservations.dto.ts
│   │   │   ├── list-staff-reservations.dto.ts
│   │   │   └── reject-reservation.dto.ts
│   │   ├── utils/  # Jam operasional, H-1/H-2, deadline, slot
│   │   │   ├── reservation-time.util.spec.ts  # Test unit
│   │   │   └── reservation-time.util.ts
│   │   ├── reservations.controller.ts
│   │   ├── reservations.module.ts
│   │   ├── reservations.scheduler.spec.ts  # Test unit
│   │   ├── reservations.scheduler.ts  # Penolakan SLA dan penyelesaian reservasi otomatis
│   │   ├── reservations.service.spec.ts  # Test unit
│   │   ├── reservations.service.ts
│   │   ├── staff-reservations.controller.spec.ts  # Test unit
│   │   └── staff-reservations.controller.ts
│   ├── app.controller.spec.ts  # Test unit
│   ├── app.controller.ts  # Endpoint dasar API
│   ├── app.module.ts  # Registrasi modul, config, dan scheduler
│   ├── app.service.ts  # Respons dasar API
│   ├── app.setup.ts  # Prefix API, CORS, cookie, validasi, envelope, error
│   └── main.ts  # Bootstrap server dan port aplikasi
├── test/  # Test end-to-end per domain
│   ├── admin-users.e2e-spec.ts
│   ├── app.e2e-spec.ts
│   ├── auth.e2e-spec.ts
│   ├── facilities.e2e-spec.ts
│   ├── jest-e2e.json  # Konfigurasi Jest untuk test e2e
│   ├── reports.e2e-spec.ts
│   └── reservations.e2e-spec.ts
├── .env.example  # Contoh variabel lingkungan
├── .gitignore  # Aturan file yang diabaikan Git
├── .oxlintrc.json  # Aturan Oxlint backend
├── .prettierignore  # Pengecualian format Prettier
├── .prettierrc  # Aturan format Prettier
├── jest.config.ts  # Konfigurasi test unit backend
├── nest-cli.json  # Build NestJS dan penyalinan aset SVG ekspor
├── package-lock.json  # Versi dependency untuk npm ci
├── package.json  # Dependency dan script npm
├── prisma7.config.ts  # Konfigurasi CLI Prisma dan DATABASE_URL
├── README.md  # Dokumentasi folder
├── tsconfig.build.json  # Kompilasi src tanpa file test
├── tsconfig.json  # Konfigurasi TypeScript
└── tsconfig.spec.json  # Konfigurasi TypeScript untuk test
```

`*.spec.ts` berada bersama source yang diperiksa. Folder `test/` menampung test end-to-end untuk auth, akun admin, fasilitas, reservasi, laporan, dan endpoint dasar.

</details>

<details>
<summary><strong>Schema, migrasi, dan data demo</strong></summary>

```text
unispace-backend/prisma/
├── schema.prisma                    # Model, relasi, enum, dan indeks aplikasi
├── seed.ts                          # Reset demo lokal dan seed awal production
├── migrations/
│   ├── migration_lock.toml          # Provider database untuk migrasi
│   └── <timestamp>_<nama>/
│       └── migration.sql            # Perubahan schema dan constraint SQL
└── seed-asset/
    └── *.webp                       # Foto ruang dan alat yang diunggah saat seed
```

Terdapat 15 file migrasi SQL dan 21 gambar WebP pada data seed. `prisma7.config.ts` menentukan lokasi schema, folder migrasi, command seed, serta koneksi `DATABASE_URL`. Hasil `npm run db:generate` berada di `src/generated/prisma/` dan digunakan oleh `PrismaService`.

</details>

<details>
<summary><strong>Struktur frontend lengkap</strong></summary>

```text
unispace-frontend/
├── public/  # Aset statis yang disajikan frontend
│   ├── Aulamuladi.jpg
│   ├── login.png
│   ├── undipbookmark.png
│   ├── Unispace_Logo.svg  # Logo ikon Unispace
│   └── Unispace_Logo_Trademark.svg  # Banner/wordmark Unispace
├── src/
│   ├── app/  # Route dan layout App Router
│   │   ├── (app)/  # Portal pengguna, petugas, admin
│   │   │   ├── (user)/  # Reservasi, laporan, profil pengguna
│   │   │   │   ├── profile/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── reports/
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── reservations/
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── admin/  # Akun, fasilitas, rekap, audit
│   │   │   │   ├── accounts/
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── verification/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── analytics/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── audit/
│   │   │   │   │   └── page.tsx  # Redirect ke /admin/audit-logs
│   │   │   │   ├── audit-logs/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── facilities/
│   │   │   │   │   ├── [facilityId]/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── areas/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── types/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── profile/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   └── staff/  # Antrean reservasi/laporan dan perbaikan
│   │   │       ├── facilities/
│   │   │       │   └── page.tsx
│   │   │       ├── maintenance/
│   │   │       │   └── page.tsx
│   │   │       ├── profile/
│   │   │       │   └── page.tsx
│   │   │       ├── reports/
│   │   │       │   └── page.tsx
│   │   │       ├── reservations/
│   │   │       │   ├── [reservationId]/
│   │   │       │   │   └── page.tsx
│   │   │       │   └── page.tsx
│   │   │       └── layout.tsx
│   │   ├── (auth)/  # Login, registrasi, status akun
│   │   │   ├── account-status/
│   │   │   │   └── page.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── (public)/  # Halaman publik
│   │   │   ├── facilities/
│   │   │   │   ├── [facilityId]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── site-header.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css  # Style global aplikasi
│   │   └── layout.tsx  # Layout root, metadata, dan AuthProvider
│   ├── components/
│   │   ├── layout/  # Shell portal admin dan petugas
│   │   │   ├── admin-shell.tsx
│   │   │   └── staff-shell.tsx
│   │   └── ui/  # Komponen UI yang dipakai bersama
│   │       ├── confirm-dialog.tsx
│   │       └── page-primitives.tsx
│   ├── features/  # Komponen, tipe, dan akses API menurut domain
│   │   ├── accounts/  # Manajemen dan verifikasi akun
│   │   │   └── components/
│   │   │       ├── account-verification.tsx
│   │   │       ├── create-user-form.tsx
│   │   │       └── users-management.tsx
│   │   ├── analytics/  # Rekap dan ekspor admin
│   │   │   ├── components/
│   │   │   │   └── analytics-page.tsx
│   │   │   └── api.ts
│   │   ├── audit/  # Halaman dan API audit
│   │   │   ├── components/
│   │   │   │   └── audit-log-page.tsx
│   │   │   └── api.ts
│   │   ├── auth/  # Form auth dan pengelolaan sesi
│   │   │   ├── components/
│   │   │   │   ├── account-status.tsx
│   │   │   │   ├── auth-shell.tsx
│   │   │   │   ├── login-form.tsx
│   │   │   │   └── register-form.tsx
│   │   │   └── auth-provider.tsx  # Sesi, refresh, dan request terautentikasi
│   │   ├── facilities/  # Katalog, editor, master, dan perbaikan
│   │   │   ├── components/
│   │   │   │   ├── admin-facilities.tsx
│   │   │   │   ├── facility-card.tsx
│   │   │   │   ├── facility-catalog.tsx
│   │   │   │   ├── facility-detail-view.tsx
│   │   │   │   ├── facility-editor.tsx
│   │   │   │   ├── facility-masters.tsx
│   │   │   │   ├── landing-page.tsx
│   │   │   │   ├── site-footer.tsx
│   │   │   │   ├── staff-facility-catalog.tsx
│   │   │   │   └── staff-maintenance.tsx
│   │   │   ├── data/  # API katalog dan perbaikan
│   │   │   │   ├── catalog-api.ts
│   │   │   │   └── staff-maintenance-api.ts
│   │   │   ├── admin-types.ts
│   │   │   └── types.ts
│   │   ├── facility-reports/  # Laporan pengguna/petugas dan foto
│   │   │   ├── components/
│   │   │   │   ├── attachment-preview.tsx
│   │   │   │   ├── create-report-page.tsx
│   │   │   │   ├── report-detail-drawer.tsx
│   │   │   │   ├── staff-report-card.tsx
│   │   │   │   ├── staff-reports.tsx
│   │   │   │   └── user-report-list.tsx
│   │   │   └── api.ts
│   │   ├── profile/  # Profil dan penggantian password
│   │   │   └── components/
│   │   │       └── profile-page.tsx
│   │   └── reservations/  # Slot, riwayat, antrean, dialog keputusan
│   │       ├── components/
│   │       │   ├── cancel-reservation-modal.tsx
│   │       │   ├── reservation-card.tsx
│   │       │   ├── slot-picker.tsx
│   │       │   ├── staff-approve-modal.tsx
│   │       │   ├── staff-cancel-modal.tsx
│   │       │   ├── staff-detail-modal.tsx
│   │       │   ├── staff-reject-modal.tsx
│   │       │   ├── staff-reservation-card.tsx
│   │       │   └── staff-reservation-table.tsx
│   │       ├── api.ts
│   │       └── types.ts
│   └── lib/  # HTTP client dan utilitas format
│       ├── api/
│       │   ├── client.ts  # HTTP client, envelope JSON, dan download file
│       │   └── error-message.ts  # Pesan error API untuk UI
│       └── format.ts  # Pemformatan nilai untuk tampilan
├── .env.example  # Contoh variabel lingkungan
├── .gitignore  # Aturan file yang diabaikan Git
├── AGENTS.md  # Instruksi pengembangan untuk asisten
├── CLAUDE.md  # Catatan pengembangan untuk asisten
├── eslint.config.mjs  # Aturan ESLint frontend
├── next.config.ts  # Remote image dan rewrite API
├── package-lock.json  # Versi dependency untuk npm ci
├── package.json  # Dependency dan script npm
├── postcss.config.mjs  # Plugin Tailwind CSS pada PostCSS
├── README.md  # Dokumentasi folder
└── tsconfig.json  # Konfigurasi TypeScript
```

Folder dalam tanda kurung, seperti `(public)`, `(auth)`, `(app)`, dan `(user)`, adalah kelompok route dan tidak menjadi bagian URL. Folder `[facilityId]` dan `[reservationId]` menjadi parameter dinamis. `page.tsx` menentukan halaman, sedangkan `layout.tsx` membungkus halaman dalam kelompoknya.

| Kelompok route | URL yang disediakan |
|---|---|
| `(public)` | `/`, `/facilities`, `/facilities/[facilityId]` |
| `(auth)` | `/login`, `/register`, `/account-status` |
| `(app)/(user)` | `/reservations`, `/reservations/new`, `/reports`, `/reports/new`, `/profile` |
| `(app)/staff` | `/staff/reservations`, `/staff/reservations/[reservationId]`, `/staff/reports`, `/staff/facilities`, `/staff/maintenance`, `/staff/profile` |
| `(app)/admin` | `/admin`, `/admin/accounts`, `/admin/accounts/new`, `/admin/accounts/verification`, `/admin/facilities`, `/admin/facilities/new`, `/admin/facilities/[facilityId]`, `/admin/facilities/areas`, `/admin/facilities/types`, `/admin/analytics`, `/admin/audit-logs`, `/admin/profile` |
| Alias audit admin | `/admin/audit` mengarahkan ke `/admin/audit-logs` |

`src/app/layout.tsx` memasang `AuthProvider` untuk seluruh halaman. Komponen domain berada di `src/features/`; komponen layout/UI bersama berada di `src/components/`. Akses HTTP terpusat di `src/lib/api/client.ts`, sedangkan fungsi API per domain berada pada `features/*/api.ts` atau `features/facilities/data/`.

</details>

### Modularitas backend

Backend dibagi berdasarkan domain dalam [AppModule](unispace-backend/src/app.module.ts): `AccountsModule` menangani autentikasi dan akun; `FacilitiesModule` menangani katalog, master, ketersediaan, dan perbaikan; `ReservationsModule` menangani reservasi, alokasi aset, dan scheduler; `ReportsModule` menangani laporan serta dashboard petugas; `AnalyticsModule` menangani rekap, ekspor, dan audit. `PrismaModule` menyediakan akses database secara global, sedangkan `HealthModule` memeriksa kesiapan database dan storage.

Controller menerima request, DTO memvalidasi input, dan service menjalankan aturan bisnis. Modul berbagi service melalui dependency injection: reservasi dan laporan mengimpor `FacilitiesModule`, sementara health memakai storage yang diekspor `ReportsModule`. Utilitas HTTP, storage, waktu, dan idempotensi berada di `common/` untuk dipakai lintas domain.

## Prasyarat menjalankan lokal

**Full run terdiri dari PostgreSQL dan object storage, backend, serta frontend.** Compose hanya menjalankan layanan data. Backend dan frontend dijalankan melalui npm pada dua terminal terpisah.

| Prasyarat | Kebutuhan |
|---|---|
| Git | Untuk clone repository. |
| Node.js dan npm | Gunakan Node.js **24 LTS** dari [unduhan resmi](https://nodejs.org/en/download). Node 24 memenuhi engine dependency proyek; Prisma 7 juga menerima Node 22.12 atau lebih baru dalam seri 22. |
| Docker dan Compose v2 | Linux: [Docker Engine sesuai distro](https://docs.docker.com/engine/install/), termasuk plugin Compose. Windows: [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) dengan WSL 2 dan Linux containers. |
| MinIO AIStor | File lisensi valid bernama `minio.license` di root untuk image Compose saat ini. Ikuti [panduan container AIStor](https://docs.min.io/aistor/installation/container/) untuk mendapatkan dan memasang lisensi. File ini tidak disimpan di Git. |
| Koneksi internet | Diperlukan saat instalasi dependency, image Docker, dan engine Prisma. |
| Port lokal | `3000` frontend, `3001` backend, `5432` PostgreSQL, `9000` API MinIO, `9001` console MinIO. |
| Browser | Browser modern untuk membuka aplikasi dan console penyimpanan. |

Docker Desktop di Windows memerlukan virtualisasi hardware aktif dan WSL 2 yang sesuai persyaratan pada dokumentasi resmi. Jika memakai WSL untuk Node dan Git, jalankan seluruh perintah Linux di distro WSL yang sama serta aktifkan integrasi distro itu di Docker Desktop.

Object storage wajib tersedia untuk full run: seed mengunggah foto, formulir laporan/fasilitas memakai upload, dan endpoint readiness memeriksa bucket. Tanpa lisensi MinIO, gunakan layanan S3 kompatibel yang sudah tersedia melalui [konfigurasi alternatif](#object-storage-alternatif). PostgreSQL tetap dapat dijalankan lokal.

Periksa tool sebelum mulai, dari Bash maupun PowerShell:

```text
git --version
node --version
npm --version
docker --version
docker compose version
docker info
```

`docker info` harus berhasil menghubungi daemon. Pada Linux yang belum mengizinkan Docker tanpa root, gunakan `sudo docker ...` atau ikuti [konfigurasi pascainstalasi Docker](https://docs.docker.com/engine/install/linux-postinstall/).

## Konfigurasi environment lokal

Terdapat **tiga file environment** dengan tujuan berbeda. Copy file contoh mengikuti petunjuk Linux atau Windows, lalu isi dengan konfigurasi berikut. File contoh backend masih memuat placeholder `username`, `password`, dan `database_name`, sehingga harus disesuaikan sebelum migrasi.

### Root `.env`

```dotenv
POSTGRES_USER=unispace
POSTGRES_PASSWORD=unispace_local_db_2026
POSTGRES_DB=unispace
POSTGRES_PORT=5432

COMPOSE_PROFILES=minio
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=unispace_local_minio_2026
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
S3_REGION=ap-southeast-1
S3_BUCKET=unispace-dev
```

`COMPOSE_PROFILES=minio` mengaktifkan `minio` dan `minio-init`. Setelah MinIO sehat, `minio-init` membuat bucket bila belum ada dan mengaturnya private. Isi root `.env` dibaca Compose.

### Backend `unispace-backend/.env`

```dotenv
APP_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:3001/api/v1

DATABASE_URL=postgresql://unispace:unispace_local_db_2026@localhost:5432/unispace?schema=public

DEFAULT_USER_PASSWORD=UnispaceDemo2026!
ADMIN_SEED_NAME=Administrator Unispace
ADMIN_SEED_IDENTITY_NUMBER=00000000
ADMIN_SEED_EMAIL=admin@unispace.local
ADMIN_SEED_PASSWORD=UnispaceAdmin2026!

JWT_ACCESS_SECRET=local_access_secret_unispace_2026_replace_me
JWT_REFRESH_SECRET=local_refresh_secret_unispace_2026_replace_me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

STORAGE_PROVIDER=MINIO
S3_ENDPOINT=http://localhost:9000
S3_REGION=ap-southeast-1
S3_BUCKET=unispace-dev
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=unispace_local_minio_2026
S3_FORCE_PATH_STYLE=true
```

### Frontend `unispace-frontend/.env`

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Nilai contoh di atas hanya untuk demo lokal. Gunakan password dan dua secret JWT berbeda milik environment masing-masing saat deployment. `.env` dan `minio.license` diabaikan Git.

| Kaitan variabel | Yang harus konsisten |
|---|---|
| `DATABASE_URL` | User, password, nama database, dan port harus cocok dengan root `.env`. Password dengan karakter khusus pada URL perlu di-encode. |
| `S3_ACCESS_KEY` dan `S3_SECRET_KEY` | Untuk MinIO lokal, sama dengan `MINIO_ROOT_USER` dan `MINIO_ROOT_PASSWORD`. |
| `S3_REGION` dan `S3_BUCKET` | Sama pada root dan backend. |
| `S3_ENDPOINT` | Mengikuti port API MinIO, bukan port console. Backend berjalan di host sehingga memakai `localhost`, bukan hostname service Compose. |
| `FRONTEND_URL` | Origin frontend yang tepat untuk CORS, termasuk port. |
| `PUBLIC_API_URL` | URL backend **dengan** `/api/v1`, digunakan untuk URL gambar fasilitas. |
| `NEXT_PUBLIC_API_URL` | Origin backend **tanpa** `/api/v1`; client menambahkan prefix sendiri. |
| `DEFAULT_USER_PASSWORD` | Password akun demo user/staff serta akun yang dibuat/reset admin. |
| `ADMIN_SEED_*` | Identitas dan password admin yang dibuat seed. Jika password admin kosong, seed lokal memakai `DEFAULT_USER_PASSWORD`. |
| `APP_ENV` | `development` untuk lokal. `production` mengaktifkan cookie Secure dan menolak seed reset biasa. |

### Object storage alternatif

Untuk memakai bucket S3 kompatibel, hapus/comment `COMPOSE_PROFILES=minio` pada root `.env`, siapkan bucket private khusus demo, dan ubah variabel backend:

```dotenv
STORAGE_PROVIDER=S3
S3_ENDPOINT=https://endpoint-storage-anda
S3_REGION=region-bucket-anda
S3_BUCKET=bucket-demo-anda
S3_ACCESS_KEY=access-key-anda
S3_SECRET_KEY=secret-key-anda
S3_FORCE_PATH_STYLE=false
```

`S3_ENDPOINT` tetap wajib sesuai validasi backend saat ini. Sesuaikan `S3_FORCE_PATH_STYLE` dengan provider. Credential harus dapat membaca bucket, membaca/menulis objek, dan, untuk seed reset lokal, mendaftar serta menghapus objek. **Seed lokal menghapus semua objek dalam bucket yang dikonfigurasi**, jadi gunakan bucket khusus data demo. Dengan pilihan ini, jalankan PostgreSQL saja menggunakan `docker compose up -d postgres`; lewati pemeriksaan MinIO pada panduan berikut.

## Full run di Linux

Langkah ini menggunakan Bash pada Linux. Contoh instalasi paket tambahan untuk Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential
```

Install Node.js 24 LTS beserta npm dari [panduan unduhan Node.js](https://nodejs.org/en/download). Untuk Docker, ikuti [instalasi Docker Engine pada distro Anda](https://docs.docker.com/engine/install/) dan pastikan plugin `docker-compose-plugin` tersedia. Pada Ubuntu, [panduan resmi](https://docs.docker.com/engine/install/ubuntu/) mencakup repository apt dan instalasi plugin. Jalankan pemeriksaan tool di bagian prasyarat sebelum melanjutkan.

### 1. Clone dan siapkan file

```bash
git clone https://github.com/Yuseonr/Unispace.git
cd Unispace
cp .env.example .env
cp unispace-backend/.env.example unispace-backend/.env
cp unispace-frontend/.env.example unispace-frontend/.env
```

Jika repository sudah ada, mulai dari root checkout Anda. Copy dilakukan pada setup pertama; pertahankan konfigurasi lokal yang sudah ada. Isi ketiga file mengikuti [konfigurasi environment lokal](#konfigurasi-environment-lokal). Untuk MinIO, letakkan file lisensi valid pada `Unispace/minio.license`.

### 2. Jalankan database dan MinIO

Dari root, setelah `.env` berisi `COMPOSE_PROFILES=minio`:

```bash
docker compose up -d
docker compose ps -a
docker compose logs --tail=100 minio-init
```

Tunggu `postgres` dan `minio` berstatus sehat. `minio-init` adalah proses sekali jalan yang seharusnya selesai dengan kode `0`, bukan terus berjalan. Bila status belum sehat, lihat log sebelum melanjutkan.

### 3. Migrasi, seed, dan jalankan backend

Pada terminal backend:

```bash
cd unispace-backend
npm ci
npm run db:generate
npm run db:deploy
npm run db:status
```

**Untuk database dan bucket demo lokal yang boleh diisi ulang**, jalankan seed sekali sebelum start. Perintah ini menghapus semua data aplikasi serta isi bucket, lalu membuat akun, katalog, reservasi, laporan, dan foto demo. Jangan jalankan pada data yang ingin dipertahankan.

```bash
npm run db:seed
npm run start:dev
```

Biarkan terminal tetap terbuka. Backend tersedia pada `http://localhost:3001/api/v1`; scheduler berjalan bersama proses backend.

### 4. Jalankan frontend

Buka terminal kedua dari root repository:

```bash
cd unispace-frontend
npm ci
npm run dev
```

Biarkan terminal tetap terbuka, kemudian buka `http://localhost:3000`.

### 5. Periksa kesiapan

Buka terminal ketiga:

```bash
curl -fsS http://localhost:3001/api/v1/health/live
curl -fsS http://localhost:3001/api/v1/health/ready
```

Respons `ready` yang sukses memuat `success: true` dan `data.checks.database: "ok"`, `data.checks.storage: "ok"`. Login dengan [akun demo](#akun-demo-dan-panduan-mencoba) untuk mulai mencoba.

## Full run di Windows

Gunakan PowerShell untuk panduan ini. Jika memilih WSL, ikuti seluruh panduan Linux dari terminal WSL; jangan mencampur instalasi dependency Windows dan WSL dalam folder yang sama.

### 1. Siapkan tool

Install [Git for Windows](https://git-scm.com/downloads/win), [Node.js 24 LTS beserta npm](https://nodejs.org/en/download), serta [Docker Desktop untuk Windows](https://docs.docker.com/desktop/setup/install/windows-install/). Buka PowerShell sebagai Administrator untuk instalasi/update WSL jika dibutuhkan:

```powershell
wsl --install
wsl --update
```

Restart jika diminta. Buka Docker Desktop, gunakan backend WSL 2 dan Linux containers, lalu tunggu engine siap. Buka PowerShell baru agar Node, npm, dan Git masuk PATH. Jalankan pemeriksaan tool pada bagian prasyarat.

### 2. Clone dan siapkan file

```powershell
git clone https://github.com/Yuseonr/Unispace.git
Set-Location Unispace
Copy-Item .env.example .env
Copy-Item unispace-backend/.env.example unispace-backend/.env
Copy-Item unispace-frontend/.env.example unispace-frontend/.env
```

Isi ketiga file sesuai [konfigurasi environment lokal](#konfigurasi-environment-lokal), misalnya melalui editor atau:

```powershell
notepad .env
notepad unispace-backend/.env
notepad unispace-frontend/.env
```

Copy file lisensi MinIO valid ke root dengan nama `minio.license`, pastikan bukan `minio.license.txt`. Bila repository sudah tersedia, mulai dari root checkout dan copy file contoh hanya saat setup pertama.

### 3. Jalankan layanan data

Dengan `COMPOSE_PROFILES=minio` aktif pada root `.env`:

```powershell
docker compose up -d
docker compose ps -a
docker compose logs --tail=100 minio-init
```

Tunggu PostgreSQL dan MinIO sehat, serta `minio-init` selesai dengan kode `0`.

### 4. Migrasi, seed, dan jalankan backend

Pada terminal backend:

```powershell
Set-Location unispace-backend
npm ci
npm run db:generate
npm run db:deploy
npm run db:status
```

Untuk **database dan bucket demo yang boleh dihapus/diisi ulang**, lanjutkan:

```powershell
npm run db:seed
npm run start:dev
```

Seed lokal menghapus data aplikasi dan seluruh objek bucket. Biarkan backend tetap berjalan pada terminal ini.

### 5. Jalankan frontend

Buka PowerShell kedua dari root repository:

```powershell
Set-Location unispace-frontend
npm ci
npm run dev
```

Buka `http://localhost:3000`. Jika PowerShell menolak `npm.ps1`, gunakan `npm.cmd` untuk setiap perintah npm, contohnya `npm.cmd ci` dan `npm.cmd run dev`.

### 6. Periksa kesiapan

Dari terminal ketiga:

```powershell
Invoke-RestMethod http://localhost:3001/api/v1/health/live | ConvertTo-Json -Depth 5
Invoke-RestMethod http://localhost:3001/api/v1/health/ready | ConvertTo-Json -Depth 5
```

Endpoint `ready` harus sukses dengan database dan storage bernilai `ok` pada `data.checks`. Lanjutkan login menggunakan akun demo.

## Akun demo dan panduan mencoba

Tabel berikut berlaku jika memakai environment contoh README dan telah berhasil menjalankan `npm run db:seed`.

| Peran/status | Email | Kata sandi contoh lokal |
|---|---|---|
| Admin aktif | `admin@unispace.local` | `UnispaceAdmin2026!` dari `ADMIN_SEED_PASSWORD` |
| Petugas aktif | `staff1@unispace.local` sampai `staff3@unispace.local` | `UnispaceDemo2026!` dari `DEFAULT_USER_PASSWORD` |
| Pengguna aktif | `user1@unispace.local` sampai `user12@unispace.local` | `UnispaceDemo2026!` |
| Menunggu verifikasi | `user13@unispace.local`, `user14@unispace.local` | Tidak dapat login sebelum disetujui admin |
| Ditolak/nonaktif | `user15@unispace.local`, `user16@unispace.local` | Tidak dapat login dalam status tersebut |

Jika nilai `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, atau `DEFAULT_USER_PASSWORD` Anda berbeda, gunakan nilai environment saat seed dijalankan. Mengubah environment setelah seed tidak otomatis mengganti password akun yang sudah tersimpan.

Urutan mencoba alur utama:

1. Buka katalog tanpa login dan lihat ketersediaan fasilitas.
2. Login sebagai pengguna aktif. Pilih hari kerja yang memenuhi H-2 dan batas 14 hari, pilih slot berurutan, isi tujuan, lalu kirim pengajuan.
3. Logout, login sebagai petugas, buka Antrean Reservasi, lalu setujui atau tolak pengajuan. Untuk alat, periksa kode aset hasil alokasi.
4. Login kembali sebagai pengguna untuk melihat status dan alasan keputusan. Kirim laporan dengan foto pada unit yang aktif.
5. Login sebagai petugas untuk menerima laporan, melihat dampak perbaikan, membuat periode, dan menyelesaikan laporan setelah periode berakhir.
6. Login sebagai admin untuk memverifikasi akun baru, mengelola fasilitas, melihat audit, dan mengekspor rekap dengan filter periode.

Registrasi baru memerlukan persetujuan admin, sehingga akun demo aktif membantu menjalankan alur pertama. Data foto seed dibaca dari `unispace-backend/prisma/seed-asset` dan diunggah ke bucket; database menyimpan referensi objeknya.

## Operasional lokal dan pemecahan masalah

### Alamat layanan

| Layanan | Alamat default |
|---|---|
| Frontend | [http://localhost:3000](http://localhost:3000) |
| API | [http://localhost:3001/api/v1](http://localhost:3001/api/v1) |
| API liveness | [http://localhost:3001/api/v1/health/live](http://localhost:3001/api/v1/health/live) |
| API readiness | [http://localhost:3001/api/v1/health/ready](http://localhost:3001/api/v1/health/ready) |
| MinIO console | [http://localhost:9001](http://localhost:9001), login dengan `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` |
| MinIO S3 API | `http://localhost:9000` |
| PostgreSQL | `localhost:5432`, credential dari root `.env` |

### Stop dan jalankan kembali

Hentikan frontend/backend dengan `Ctrl+C` pada terminal masing-masing. Dari root:

```text
docker compose down
```

Named volume database dan storage tetap tersimpan. Untuk menjalankan lagi, gunakan `docker compose up -d`, lalu `npm run start:dev` pada backend dan `npm run dev` pada frontend. Tidak perlu seed ulang. Hindari `docker compose down -v` bila ingin mempertahankan data, karena opsi itu menghapus volume.

### Script yang tersedia

Jalankan script dari folder yang ditunjukkan, bukan root repository.

| Folder | Perintah | Fungsi |
|---|---|---|
| Backend | `npm run db:generate` | Membuat Prisma client dari schema. |
| Backend | `npm run db:deploy` | Menerapkan migrasi yang sudah ada pada database. |
| Backend | `npm run db:status` | Melihat status migrasi. |
| Backend | `npm run db:migrate` | Membuat/menerapkan migrasi development setelah perubahan schema; bukan langkah setup awal. |
| Backend | `npm run db:seed` | Reset seluruh data demo dan isi bucket di development. |
| Backend | `npm run db:seed:initial` | Seed awal production dengan database aplikasi kosong. |
| Backend | `npm run start:dev` | Menjalankan API dengan watch. |
| Backend | `npm run build` lalu `npm run start:prod` | Build dan jalankan hasil kompilasi. |
| Backend | `npm run lint`, `npm run format:check` | Pemeriksaan lint dan format. |
| Backend | `npm run test`, `npm run test:e2e` | Test unit dan end-to-end yang tersedia. Test e2e memerlukan PostgreSQL dan environment test sesuai file test. |
| Backend | `npm run check` | Format, lint, build, dan test unit berurutan. |
| Frontend | `npm run dev` | Menjalankan Next.js development. |
| Frontend | `npm run build` lalu `npm run start` | Build dan menjalankan hasil build. |
| Frontend | `npm run lint` | Pemeriksaan ESLint. |

`npm ci` mengikuti lockfile untuk instalasi awal. Environment frontend yang memakai `NEXT_PUBLIC_*` ikut hasil build, jadi build ulang bila nilainya berubah. Untuk mencoba hasil build pada HTTP lokal, pertahankan backend `APP_ENV=development`; konfigurasi `production` memerlukan HTTPS untuk cookie Secure.

### Masalah yang umum

| Gejala | Penyebab/penyelesaian |
|---|---|
| Docker tidak tersambung atau permission denied | Buka Docker Desktop di Windows. Pada Linux, pastikan daemon aktif dan akses Docker tersedia; gunakan `sudo` bila diperlukan. |
| `minio.license` dianggap direktori/file tidak ditemukan | Pastikan file lisensi valid ada di root sebelum start Compose. Pada Windows, periksa ekstensi file. Lihat `docker compose logs --tail=100 minio`. |
| MinIO sehat tetapi storage gagal | Lihat log `minio-init`, kesamaan credential, region, nama bucket, dan port API. Bucket harus sudah dibuat sebelum seed/readiness. |
| Migrasi gagal terhubung ke database | Tunggu PostgreSQL sehat; samakan `DATABASE_URL` dengan root `.env`. Mengubah password root `.env` pada volume yang sudah ada tidak otomatis mengganti password database lama. |
| Prisma client belum ditemukan | Jalankan `npm run db:generate` dari backend setelah dependency terpasang. |
| Backend menolak environment kosong | Isi variabel wajib database, frontend, JWT, serta S3. `S3_ENDPOINT` tetap wajib untuk `STORAGE_PROVIDER=S3`. |
| Port sudah dipakai | Ubah port root/`PORT`, lalu sesuaikan `DATABASE_URL`, `S3_ENDPOINT`, `PUBLIC_API_URL`, `FRONTEND_URL`, dan `NEXT_PUBLIC_API_URL` yang terkait. Jalankan ulang proses. |
| Next.js berpindah ke port 3002 | Kosongkan port 3000 atau set `FRONTEND_URL` sesuai origin baru sebelum restart backend. |
| CORS atau sesi refresh gagal | Gunakan hostname konsisten, misalnya semuanya `localhost`. `FRONTEND_URL` harus sesuai origin browser. Lokal HTTP memakai `APP_ENV=development`. |
| API dipanggil dengan `/api/v1/api/v1` | Isi `NEXT_PUBLIC_API_URL` hanya origin backend, tanpa prefix. |
| Gambar gagal dimuat pada backend selain localhost:3001 | Set `BACKEND_API_URL` di frontend ke origin backend untuk konfigurasi remote image dan rewrite. Jika memakai rewrite, set `NEXT_PUBLIC_API_URL=/`, kemudian restart frontend. |
| Login akun baru ditolak | Akun belum `ACTIVE`; admin perlu memverifikasi. Password akun demo mengikuti environment pada waktu seed. |
| Reservasi ditolak karena jadwal | Periksa hari kerja, H-2, batas 14 hari, slot 30 menit, stok/bentrok, dan perbaikan terjadwal. |
| `npm.ps1 cannot be loaded` di PowerShell | Gunakan `npm.cmd` pada terminal tersebut. |
| Instalasi bcrypt gagal | Pastikan Node yang didukung dan jaringan tersedia. Bila perlu kompilasi native, Linux memerlukan Python 3 dan build tools; Windows memerlukan Python dan Visual Studio Build Tools dengan C++. |

## ERD lengkap

### Enum dan constraint yang perlu dibaca bersama ERD

| Enum | Nilai |
|---|---|
| `UserRole` | `USER`, `STAFF`, `ADMIN` |
| `AccountStatus` | `PENDING_VERIFICATION`, `ACTIVE`, `REJECTED`, `NONACTIVE` |
| `ReservationMode` | `EXCLUSIVE`, `QUANTITY` |
| `FacilityStatus` | `ACTIVE`, `IN_MAINTENANCE`, `NONACTIVE` |
| `FacilityAreaStatus`, `FacilityTypeStatus` | `ACTIVE`, `NONACTIVE` |
| `ReservationStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED_BY_USER`, `CANCELLED_BY_STAFF`, `CANCELLED_BY_SYSTEM`, `COMPLETED` |
| `ReportCategory` | `PHYSICAL_DAMAGE`, `ELECTRICAL_ELECTRONICS`, `CLEANLINESS`, `FURNITURE_EQUIPMENT`, `SECURITY`, `OTHER` |
| `ReportStatus` | `NEW`, `IN_PROGRESS`, `RESOLVED`, `REJECTED` |
| `StorageProvider` | `MINIO`, `S3` |

- `Reservation.facility_id` dan `facility_group_id` saling eksklusif: tepat satu terisi. `EXCLUSIVE` menargetkan unit, `QUANTITY` menargetkan kelompok. Unit hasil alokasi dicatat pada `ReservationItem`.
- Unique gabungan: `ReservationItem(reservation_id, facility_id)`, `ReportAttachment(storage_provider, object_key)`, dan `IdempotencyRecord(actor_id, key)`. Anggota unique gabungan tidak ditandai `UK` individual.
- `MaintenancePeriod.report_id` boleh kosong untuk perbaikan mandiri; `created_by_id` menyimpan pembuat. `ended_early` mencatat akhir periode yang dipercepat.
- `FacilityStatusHistory.changed_by` dan `AuditLog.actor_id` boleh kosong untuk perubahan oleh sistem.
- `AuditLog.entity_id` adalah referensi logis ke entitas sesuai `entity_type`, bukan foreign key ke satu tabel tertentu.
- Migrasi SQL menambahkan validasi target reservasi, slot, jam/hari operasional, tujuan tidak kosong, proteksi bentrok ruang melalui exclusion constraint, dan validasi data domain. Aturan transaksi/stok alat juga diterapkan oleh service.
- Kolom waktu memakai `timestamptz`, kecuali tanggal penggunaan (`date`) serta jam awal/akhir reservasi (`time`). Nilai tanggal dan slot ditafsirkan dalam `Asia/Jakarta` oleh aplikasi.

```mermaid
erDiagram
    User o|..o{ User : "verifiedBy"
    FacilityType ||..o{ FacilityGroup : "facilityType"
    FacilityArea ||..o{ FacilityGroup : "facilityArea"
    FacilityGroup ||..o{ Facility : "facilityGroup"
    Facility ||..o{ FacilityStatusHistory : "facility"
    User o|..o{ FacilityStatusHistory : "changedBy"
    User ||..o{ Reservation : "user"
    Facility o|..o{ Reservation : "facility"
    FacilityGroup o|..o{ Reservation : "facilityGroup"
    User o|..o{ Reservation : "processedBy"
    Reservation ||..o{ ReservationItem : "reservation"
    Facility ||..o{ ReservationItem : "facility"
    User ||..o{ FacilityReport : "reporter"
    Facility ||..o{ FacilityReport : "facility"
    User o|..o{ FacilityReport : "acceptedBy"
    User o|..o{ FacilityReport : "resolvedBy"
    User o|..o{ FacilityReport : "processedBy"
    FacilityReport ||..o{ ReportAttachment : "report"
    Facility ||..o{ MaintenancePeriod : "facility"
    FacilityReport o|..o{ MaintenancePeriod : "report"
    User o|..o{ MaintenancePeriod : "createdBy"
    User o|..o{ AuditLog : "actor"
    User ||..o{ IdempotencyRecord : "actor"

    User {
        uuid id PK
        string name
        string identity_number UK
        string email UK
        text password_hash
        text refresh_token_hash "nullable"
        UserRole role
        AccountStatus account_status
        text verification_reason "nullable"
        uuid verified_by FK "nullable"
        timestamptz verified_at "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    FacilityType {
        uuid id PK
        string name UK
        FacilityTypeStatus status
    }

    FacilityArea {
        uuid id PK
        string code UK
        string name UK
        FacilityAreaStatus status
        timestamptz created_at
        timestamptz updated_at
    }

    FacilityGroup {
        uuid id PK
        string name
        uuid facility_type_id FK
        ReservationMode reservation_mode
        uuid facility_area_id FK
        text location_detail
        int capacity "nullable"
        text description "nullable"
        text primary_image_url "nullable"
        text primary_image_object_key "nullable"
    }

    Facility {
        uuid id PK
        uuid facility_group_id FK
        string asset_code UK
        string name "nullable"
        int capacity "nullable"
        text description "nullable"
        text primary_image_url "nullable"
        text primary_image_object_key "nullable"
        FacilityStatus status
        timestamptz created_at
        timestamptz updated_at
    }

    FacilityStatusHistory {
        uuid id PK
        uuid facility_id FK
        FacilityStatus status
        uuid changed_by FK "nullable"
        timestamptz effective_at
    }

    Reservation {
        uuid id PK
        string reservation_number UK
        uuid user_id FK
        uuid facility_id FK "nullable"
        uuid facility_group_id FK "nullable"
        int requested_quantity
        date usage_date
        time start_time
        time end_time
        text purpose
        ReservationStatus status
        timestamptz decision_deadline
        text decision_reason "nullable"
        uuid processed_by FK "nullable"
        timestamptz decided_at "nullable"
        timestamptz cancelled_at "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    ReservationItem {
        uuid id PK
        uuid reservation_id FK
        uuid facility_id FK
        timestamptz allocated_at
    }

    FacilityReport {
        uuid id PK
        string report_number UK
        uuid reporter_id FK
        uuid facility_id FK
        ReportCategory category
        text description
        ReportStatus status
        text decision_reason "nullable"
        text resolution_note "nullable"
        uuid accepted_by FK "nullable"
        timestamptz accepted_at "nullable"
        uuid resolved_by FK "nullable"
        timestamptz resolved_at "nullable"
        uuid processed_by FK "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    ReportAttachment {
        uuid id PK
        uuid report_id FK
        StorageProvider storage_provider
        text object_key
        text object_url
        string original_filename
        string mime_type
        int size_bytes
        timestamptz created_at
    }

    MaintenancePeriod {
        uuid id PK
        uuid facility_id FK
        uuid report_id FK "nullable"
        uuid created_by_id FK "nullable"
        timestamptz start_at
        timestamptz end_at
        boolean ended_early
        text note "nullable"
        timestamptz created_at
    }

    AuditLog {
        uuid id PK
        uuid actor_id FK "nullable"
        string action
        string entity_type
        uuid entity_id
        json metadata "nullable"
        timestamptz created_at
    }

    IdempotencyRecord {
        uuid id PK
        uuid actor_id FK
        string key
        string request_hash
        json response "nullable"
        int status_code
        timestamptz created_at
        timestamptz completed_at "nullable"
        timestamptz expires_at
    }
```

## Dokumentasi API lengkap

Base URL lokal: **`http://localhost:3001/api/v1`**.

<details>
<summary><strong>Kontrak umum: header, autentikasi, status HTTP, dan respons JSON</strong></summary>

| Bagian | Format/keterangan |
|---|---|
| Base URL | `http://localhost:3001/api/v1` pada lokal. Semua path endpoint di bawah sudah mencakup prefix. |
| Access token | `Authorization: Bearer <accessToken>` untuk endpoint terproteksi. Akun harus tetap ACTIVE. |
| Refresh token | Cookie `unispace_refresh_token`, HttpOnly, SameSite=Lax, path `/api/v1/auth`. Kirim dengan cookie jar atau `credentials: include`. |
| Body JSON | `Content-Type: application/json`. Field di luar DTO ditolak dengan 400. |
| Upload | `multipart/form-data`; biarkan client menentukan boundary. Gunakan `primaryImage` untuk foto fasilitas, `photos` berulang untuk foto laporan. |
| Idempotensi | `Idempotency-Key` opsional hanya pada pembuatan laporan dan konfirmasi perbaikan dari laporan/mandiri. Panjang 8 sampai 255 karakter; berlaku per aktor selama 24 jam. |
| Sukses | GET/PATCH mengembalikan 200. Semua POST saat ini mengembalikan 201, termasuk login, refresh, logout, preview, reset password, dan pemeriksaan SLA. |
| Paginasi | Tidak seragam: reservasi memakai `data`/`meta`; akun/laporan/audit/perbaikan memakai `items`/`page`/`limit`/`total`/`totalPages`; katalog memisahkan `exclusive` dan `quantity`. |
| Waktu | Input tanggal `YYYY-MM-DD`, input slot `HH:mm` WIB. Scalar waktu pada respons reservasi berupa ISO, misalnya `1970-01-01T09:00:00.000Z`; bagian jam menyatakan slot, bukan timestamp kegiatan. Preview penonaktifan akun memformat ulang menjadi `HH:mm`. |
| Respons file | Gambar dan ekspor sukses berupa binary/stream dengan Content-Type sesuai file. Kegagalan sebelum stream dimulai mengikuti format error JSON. |

Contoh respons sukses:

```json
{
  "success": true,
  "statusCode": 200,
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-14T06:00:00.000Z",
  "data": { "status": "ok" }
}
```

Contoh validasi gagal:

```json
{
  "success": false,
  "statusCode": 400,
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-14T06:00:00.000Z",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "field": "purpose", "messages": ["purpose must not be blank"] }
    ]
  }
}
```

| Status gagal | Arti/kode yang umum |
|---|---|
| 400 | DTO/path/query tidak valid (`VALIDATION_ERROR`, `HTTP_400`), target/waktu/aturan bisnis tidak terpenuhi. |
| 401 | Token akses hilang/tidak valid (`AUTHENTICATION_REQUIRED`, `INVALID_ACCESS_TOKEN`), credential salah, atau refresh tidak valid/dicabut. |
| 403 | Role tidak diizinkan (`ROLE_FORBIDDEN`), akun bukan ACTIVE, atau akses data milik pengguna lain. |
| 404 | Entitas atau file tidak ditemukan. |
| 409 | Data unik bentrok, transisi status tidak sah, konflik maintenance, atau idempotensi. |
| 413 | Foto melebihi batas ukuran; kode `REPORT_PHOTO_TOO_LARGE` atau `FACILITY_IMAGE_TOO_LARGE`. |
| 500 | Error internal yang tidak dipetakan menjadi HttpException, dengan `INTERNAL_SERVER_ERROR`. |
| 503 | Readiness/storage gagal, misalnya `SERVICE_NOT_READY` atau `OBJECT_STORAGE_UNAVAILABLE`. |

Dengan Idempotency-Key yang sama dan isi request sama, API mengembalikan hasil tersimpan. Isi berbeda menghasilkan 409 `IDEMPOTENCY_KEY_REUSED`; request yang masih berjalan menghasilkan 409 `IDEMPOTENCY_REQUEST_IN_PROGRESS`. Gunakan key baru untuk aksi baru dan pertahankan key yang sama saat retry aksi tersebut. Header ini tidak diterima sebagai fitur idempotensi pada endpoint reservasi.

Contoh cURL memakai Bash; pada Windows jalankan melalui Git Bash/WSL, atau sesuaikan sintaks quoting dan gunakan curl.exe di PowerShell. Semua GET rekap menerima allTime=true; alur ekspor memerlukan rentang tanggal.

Nilai enum tersedia pada [bagian ERD](#enum-dan-constraint-yang-perlu-dibaca-bersama-erd). Respons JSON per endpoint di bawah menunjukkan **isi `data`**; server membungkusnya dengan envelope sukses di atas. `null` adalah nilai eksplisit; field bernilai `undefined` tidak muncul dalam JSON.

</details>


### Autentikasi dan profil


| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Publik | Mendaftarkan pengguna baru dengan status PENDING_VERIFICATION. |
| POST | `/api/v1/auth/login` | Publik | Login akun aktif, menerbitkan access token, dan memasang cookie refresh. |
| POST | `/api/v1/auth/refresh` | Publik | Merotasi sesi menggunakan cookie refresh yang masih valid. |
| POST | `/api/v1/auth/logout` | Publik | Mencabut sesi refresh dan menghapus cookie. |
| GET | `/api/v1/auth/me` | USER, STAFF, ADMIN | Mengambil identitas akun aktif dari access token. |
| PATCH | `/api/v1/auth/password` | USER, STAFF, ADMIN | Mengganti kata sandi dengan verifikasi kata sandi lama dan memperbarui sesi. |

<details>
<summary><strong>POST /api/v1/auth/register</strong></summary>

Mendaftarkan pengguna baru dengan status PENDING_VERIFICATION.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/auth/auth.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| name | body | string | Ya | Panjang minimum 2; Panjang maksimum 120; Huruf Unicode, spasi, apostrof, titik, atau tanda hubung; spasi dinormalisasi | - |
| identityNumber | body | string | Ya | 8 sampai 30 digit, tetap string | - |
| email | body | string | Ya | Panjang maksimum 320; Email valid, dipangkas dan huruf kecil | - |
| password | body | string | Ya | Panjang minimum 12; Panjang maksimum 24; Tidak boleh hanya spasi; spasi tidak dipangkas | - |

**Contoh body JSON**

```json
{
  "name": "Pengguna Baru",
  "identityNumber": "24060124130071",
  "email": "pengguna@kampus.ac.id",
  "password": "UnispaceDemo2026!"
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  --data '{"name":"Pengguna Baru","identityNumber":"24060124130071","email":"pengguna@kampus.ac.id","password":"UnispaceDemo2026!"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Pengguna Baru",
  "identityNumber": "24060124130071",
  "email": "pengguna@kampus.ac.id",
  "role": "USER",
  "accountStatus": "PENDING_VERIFICATION"
}
```

Role tidak dikirim pada registrasi. Akun baru belum dapat login sampai disetujui admin. Password 12 sampai 24 karakter, tidak boleh hanya spasi; spasi tidak dipangkas.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 409 | ACCOUNT_ALREADY_EXISTS: email atau NIM/NIP sudah digunakan. |

</details>

<details>
<summary><strong>POST /api/v1/auth/login</strong></summary>

Login akun aktif, menerbitkan access token, dan memasang cookie refresh.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/auth/auth.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| email | body | string | Ya | Panjang maksimum 320; Email valid, dipangkas dan huruf kecil | - |
| password | body | string | Ya | Panjang minimum 1; Panjang maksimum 24 | - |

**Contoh body JSON**

```json
{
  "email": "user1@unispace.local",
  "password": "UnispaceDemo2026!"
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/auth/login" \
  -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  --data '{"email":"user1@unispace.local","password":"UnispaceDemo2026!"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "accessToken": "<access-token-jwt>",
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "identityNumber": "24060001",
    "email": "user1@unispace.local",
    "role": "USER",
    "accountStatus": "ACTIVE"
  }
}
```

Cookie bernama unispace_refresh_token: HttpOnly, SameSite=Lax, path /api/v1/auth; Secure hanya pada APP_ENV=production. Refresh token tidak dimasukkan ke JSON.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | INVALID_CREDENTIALS: email/password salah. |
| 403 | ACCOUNT_PENDING_VERIFICATION / ACCOUNT_REJECTED / ACCOUNT_NONACTIVE. |

</details>

<details>
<summary><strong>POST /api/v1/auth/refresh</strong></summary>

Merotasi sesi menggunakan cookie refresh yang masih valid.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/auth/auth.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| unispace_refresh_token | cookie | string | Ya | Cookie dari login, bukan field body | - |

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/auth/refresh" \
  -b cookies.txt -c cookies.txt
```

**Contoh isi `data` pada respons sukses**

```json
{
  "accessToken": "<access-token-jwt>",
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "identityNumber": "24060001",
    "email": "user1@unispace.local",
    "role": "USER",
    "accountStatus": "ACTIVE"
  }
}
```

Body tidak diperlukan. Kirim cookie dari login; refresh menghasilkan access token dan cookie baru. Cookie lama dapat tidak lagi valid setelah rotasi.

| Status gagal utama | Kondisi |
|---|---|
| 401 | INVALID_REFRESH_TOKEN atau REFRESH_TOKEN_REVOKED. |

</details>

<details>
<summary><strong>POST /api/v1/auth/logout</strong></summary>

Mencabut sesi refresh dan menghapus cookie.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/auth/auth.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| unispace_refresh_token | cookie | string | Tidak | Cookie dari login, bukan field body | - |

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/auth/logout" \
  -b cookies.txt -c cookies.txt
```

**Contoh isi `data` pada respons sukses**

```json
{
  "loggedOut": true
}
```

Body tidak diperlukan. Cookie refresh dipakai bila tersedia; endpoint tetap publik.

</details>

<details>
<summary><strong>GET /api/v1/auth/me</strong></summary>

Mengambil identitas akun aktif dari access token.

| Properti | Nilai |
|---|---|
| Akses | USER, STAFF, ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/auth/auth.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/auth/me" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Pengguna Demo 01",
  "identityNumber": "24060001",
  "email": "user1@unispace.local",
  "role": "USER",
  "accountStatus": "ACTIVE"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>PATCH /api/v1/auth/password</strong></summary>

Mengganti kata sandi dengan verifikasi kata sandi lama dan memperbarui sesi.

| Properti | Nilai |
|---|---|
| Akses | USER, STAFF, ADMIN |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/auth/auth.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| currentPassword | body | string | Ya | Panjang minimum 1; Panjang maksimum 24 | - |
| newPassword | body | string | Ya | Panjang minimum 12; Panjang maksimum 24; Tidak boleh hanya spasi; spasi tidak dipangkas | - |

**Contoh body JSON**

```json
{
  "currentPassword": "UnispaceDemo2026!",
  "newPassword": "UnispaceBaru2026!"
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/auth/password" \
  -H "Authorization: Bearer <accessToken>" \
  -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  --data '{"currentPassword":"UnispaceDemo2026!","newPassword":"UnispaceBaru2026!"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "accessToken": "<access-token-jwt>",
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "identityNumber": "24060001",
    "email": "user1@unispace.local",
    "role": "USER",
    "accountStatus": "ACTIVE"
  }
}
```

currentPassword 1 sampai 24 karakter; newPassword 12 sampai 24 karakter dan tidak boleh hanya spasi. Respons memperbarui access token dan cookie refresh.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 401 | CURRENT_PASSWORD_INCORRECT. |

</details>


### Akun admin


| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/v1/admin/users` | ADMIN | Daftar akun USER/STAFF beserta verifikasinya. |
| GET | `/api/v1/admin/users/:userId/deactivation-preview` | ADMIN | Melihat reservasi yang akan ditolak/dibatalkan saat akun dinonaktifkan. |
| GET | `/api/v1/admin/users/:userId` | ADMIN | Detail akun yang dapat dikelola admin. |
| POST | `/api/v1/admin/users` | ADMIN | Membuat USER atau STAFF aktif dengan DEFAULT_USER_PASSWORD. |
| PATCH | `/api/v1/admin/users/:userId/verify` | ADMIN | Menyetujui registrasi PENDING_VERIFICATION menjadi ACTIVE. |
| PATCH | `/api/v1/admin/users/:userId/reject` | ADMIN | Menolak registrasi dengan alasan. |
| PATCH | `/api/v1/admin/users/:userId/status` | ADMIN | Mengaktifkan kembali atau menonaktifkan akun beserta dampak reservasinya. |
| POST | `/api/v1/admin/users/:userId/reset-password` | ADMIN | Mereset password ke DEFAULT_USER_PASSWORD dan mencabut sesi refresh. |

<details>
<summary><strong>GET /api/v1/admin/users</strong></summary>

Daftar akun USER/STAFF beserta verifikasinya.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/users/admin-users.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| role | query | (typeof MANAGEABLE_ROLES)[number] | Tidak | Hanya USER atau STAFF | - |
| status | query | AccountStatus | Tidak | Pilihan: `PENDING_VERIFICATION`, `ACTIVE`, `REJECTED`, `NONACTIVE` | - |
| search | query | string | Tidak | Panjang maksimum 320 | - |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 100 | 20 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/users?role=USER&status=ACTIVE&page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "name": "Pengguna Demo 01",
      "identityNumber": "24060001",
      "email": "user1@unispace.local",
      "role": "USER",
      "accountStatus": "ACTIVE",
      "verification": {
        "reason": null,
        "verifiedAt": "2026-10-14T06:00:00.000Z",
        "verifiedBy": {
          "id": "99999999-9999-4999-8999-999999999999",
          "name": "Administrator Unispace",
          "email": "admin@unispace.local"
        }
      },
      "createdAt": "2026-10-14T06:00:00.000Z",
      "updatedAt": "2026-10-14T06:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

Hanya USER/STAFF yang dikelola endpoint admin/users. Akun ADMIN tidak termasuk daftar ini.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/admin/users/:userId/deactivation-preview</strong></summary>

Melihat reservasi yang akan ditolak/dibatalkan saat akun dinonaktifkan.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/users/admin-users.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| userId | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/users/11111111-1111-4111-8111-111111111111/deactivation-preview" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "account": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "identityNumber": "24060001",
    "email": "user1@unispace.local"
  },
  "pendingReservations": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "reservationNumber": "RSV-20261014060000-ABC123",
      "usageDate": "2026-10-19",
      "startTime": "09:00",
      "endTime": "10:00",
      "facilityName": "Ruang Kelas 101",
      "assetCode": "R-KLS-101",
      "areaName": "Kampus Tembalang",
      "requestedQuantity": 1
    }
  ],
  "approvedReservations": []
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>GET /api/v1/admin/users/:userId</strong></summary>

Detail akun yang dapat dikelola admin.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/users/admin-users.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| userId | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/users/11111111-1111-4111-8111-111111111111" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Pengguna Demo 01",
  "identityNumber": "24060001",
  "email": "user1@unispace.local",
  "role": "USER",
  "accountStatus": "ACTIVE",
  "verification": {
    "reason": null,
    "verifiedAt": "2026-10-14T06:00:00.000Z",
    "verifiedBy": {
      "id": "99999999-9999-4999-8999-999999999999",
      "name": "Administrator Unispace",
      "email": "admin@unispace.local"
    }
  },
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>POST /api/v1/admin/users</strong></summary>

Membuat USER atau STAFF aktif dengan DEFAULT_USER_PASSWORD.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/users/admin-users.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| name | body | string | Ya | Panjang minimum 2; Panjang maksimum 120; Huruf Unicode, spasi, apostrof, titik, atau tanda hubung; spasi dinormalisasi | - |
| identityNumber | body | string | Ya | 8 sampai 30 digit, tetap string | - |
| email | body | string | Ya | Panjang maksimum 320; Email valid, dipangkas dan huruf kecil | - |
| role | body | (typeof MANAGEABLE_ROLES)[number] | Ya | Hanya USER atau STAFF | - |

**Contoh body JSON**

```json
{
  "name": "Pengguna Baru",
  "identityNumber": "24060124130071",
  "email": "pengguna@kampus.ac.id",
  "role": "USER"
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/admin/users" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"name":"Pengguna Baru","identityNumber":"24060124130071","email":"pengguna@kampus.ac.id","role":"USER"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Pengguna Baru",
  "identityNumber": "24060124130071",
  "email": "pengguna@kampus.ac.id",
  "role": "USER",
  "accountStatus": "ACTIVE",
  "verification": {
    "reason": null,
    "verifiedAt": null,
    "verifiedBy": null
  },
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 409 | Email atau NIM/NIP sudah digunakan. |

</details>

<details>
<summary><strong>PATCH /api/v1/admin/users/:userId/verify</strong></summary>

Menyetujui registrasi PENDING_VERIFICATION menjadi ACTIVE.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/users/admin-users.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| userId | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/admin/users/11111111-1111-4111-8111-111111111111/verify" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Pengguna Demo 01",
  "identityNumber": "24060001",
  "email": "user1@unispace.local",
  "role": "USER",
  "accountStatus": "ACTIVE",
  "verification": {
    "reason": null,
    "verifiedAt": "2026-10-14T06:00:00.000Z",
    "verifiedBy": {
      "id": "99999999-9999-4999-8999-999999999999",
      "name": "Administrator Unispace",
      "email": "admin@unispace.local"
    }
  },
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Status akun tidak sesuai transisi yang diizinkan. |

</details>

<details>
<summary><strong>PATCH /api/v1/admin/users/:userId/reject</strong></summary>

Menolak registrasi dengan alasan.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/users/admin-users.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| userId | path | string (UUID) | Ya | ID sesuai entitas | - |
| reason | body | string | Ya | Panjang maksimum 1000; Tidak boleh hanya spasi | - |

**Contoh body JSON**

```json
{
  "reason": "Identitas belum dapat diverifikasi."
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/admin/users/11111111-1111-4111-8111-111111111111/reject" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"reason":"Identitas belum dapat diverifikasi."}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Pengguna Demo 01",
  "identityNumber": "24060001",
  "email": "user1@unispace.local",
  "role": "USER",
  "accountStatus": "REJECTED",
  "verification": {
    "reason": "Identitas belum dapat diverifikasi.",
    "verifiedAt": "2026-10-14T06:00:00.000Z",
    "verifiedBy": {
      "id": "99999999-9999-4999-8999-999999999999",
      "name": "Administrator Unispace",
      "email": "admin@unispace.local"
    }
  },
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Status akun tidak sesuai transisi yang diizinkan. |

</details>

<details>
<summary><strong>PATCH /api/v1/admin/users/:userId/status</strong></summary>

Mengaktifkan kembali atau menonaktifkan akun beserta dampak reservasinya.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/users/admin-users.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| userId | path | string (UUID) | Ya | ID sesuai entitas | - |
| status | body | (typeof MANAGEABLE_STATUSES)[number] | Ya | ACTIVE atau NONACTIVE | - |

**Contoh body JSON**

```json
{
  "status": "NONACTIVE"
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/admin/users/11111111-1111-4111-8111-111111111111/status" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"status":"NONACTIVE"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Pengguna Demo 01",
  "identityNumber": "24060001",
  "email": "user1@unispace.local",
  "role": "USER",
  "accountStatus": "NONACTIVE",
  "verification": {
    "reason": null,
    "verifiedAt": null,
    "verifiedBy": null
  },
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

ACTIVE hanya dari NONACTIVE; NONACTIVE hanya dari ACTIVE. Penonaktifan menolak semua PENDING dan membatalkan APPROVED yang belum berakhir sebagai CANCELLED_BY_SYSTEM.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Status akun tidak sesuai transisi yang diizinkan. |

</details>

<details>
<summary><strong>POST /api/v1/admin/users/:userId/reset-password</strong></summary>

Mereset password ke DEFAULT_USER_PASSWORD dan mencabut sesi refresh.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/accounts/users/admin-users.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| userId | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/admin/users/11111111-1111-4111-8111-111111111111/reset-password" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Pengguna Demo 01",
  "identityNumber": "24060001",
  "email": "user1@unispace.local",
  "role": "USER",
  "accountStatus": "ACTIVE",
  "verification": {
    "reason": null,
    "verifiedAt": "2026-10-14T06:00:00.000Z",
    "verifiedBy": {
      "id": "99999999-9999-4999-8999-999999999999",
      "name": "Administrator Unispace",
      "email": "admin@unispace.local"
    }
  },
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

Hanya akun ACTIVE/NONACTIVE. Nilai password tidak dikembalikan API; admin menyampaikannya di luar aplikasi.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Status akun tidak sesuai transisi yang diizinkan. |

</details>


### Katalog publik dan gambar


| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/v1/facilities/types` | Publik | Daftar tipe fasilitas aktif untuk katalog. |
| GET | `/api/v1/facilities/areas` | Publik | Daftar area kampus aktif untuk katalog. |
| GET | `/api/v1/facilities` | Publik | Katalog ruang eksklusif dan kelompok alat, dengan pagination terpisah. |
| GET | `/api/v1/facilities/:id/availability` | Publik | Ketersediaan slot satu unit atau kelompok pada tanggal tertentu. |
| GET | `/api/v1/facilities/:id` | Publik | Detail unit EXCLUSIVE atau kelompok QUANTITY sesuai kind. |
| GET | `/api/v1/facilities/images/:fileName` | Publik | Mengalirkan foto utama fasilitas dari bucket private. |

<details>
<summary><strong>GET /api/v1/facilities/types</strong></summary>

Daftar tipe fasilitas aktif untuk katalog.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/facilities.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/facilities/types"
```

**Contoh isi `data` pada respons sukses**

```json
[
  {
    "id": "44444444-4444-4444-8444-444444444444",
    "name": "Ruang Kelas",
    "status": "ACTIVE"
  }
]
```

</details>

<details>
<summary><strong>GET /api/v1/facilities/areas</strong></summary>

Daftar area kampus aktif untuk katalog.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/facilities.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/facilities/areas"
```

**Contoh isi `data` pada respons sukses**

```json
[
  {
    "id": "55555555-5555-4555-8555-555555555555",
    "code": "TEMBALANG",
    "name": "Kampus Tembalang",
    "status": "ACTIVE",
    "createdAt": "2026-10-14T06:00:00.000Z",
    "updatedAt": "2026-10-14T06:00:00.000Z"
  }
]
```

</details>

<details>
<summary><strong>GET /api/v1/facilities</strong></summary>

Katalog ruang eksklusif dan kelompok alat, dengan pagination terpisah.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| facilityTypeId | query | string (UUID) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityAreaId | query | string (UUID) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| minCapacity | query | integer | Tidak | Nilai minimum 0 | - |
| search | query | string | Tidak | Panjang maksimum 150 | - |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 50 | 20 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/facilities?minCapacity=30&page=1&limit=20"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "exclusive": {
    "data": [
      {
        "kind": "EXCLUSIVE",
        "id": "22222222-2222-4222-8222-222222222222",
        "assetCode": "R-KLS-101",
        "name": "Ruang Kelas 101",
        "facilityType": {
          "id": "44444444-4444-4444-8444-444444444444",
          "name": "Ruang Kelas"
        },
        "facilityArea": {
          "id": "55555555-5555-4555-8555-555555555555",
          "code": "TEMBALANG",
          "name": "Kampus Tembalang"
        },
        "locationDetail": "Gedung A, Lantai 1",
        "capacity": 30,
        "description": "Ruang untuk kegiatan kuliah.",
        "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
        "status": "ACTIVE"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  },
  "quantity": {
    "data": [
      {
        "kind": "QUANTITY",
        "id": "33333333-3333-4333-8333-333333333333",
        "name": "Proyektor Epson EB-X06",
        "facilityType": {
          "id": "44444444-4444-4444-8444-444444444444",
          "name": "Peralatan"
        },
        "facilityArea": {
          "id": "55555555-5555-4555-8555-555555555555",
          "code": "TEMBALANG",
          "name": "Kampus Tembalang"
        },
        "locationDetail": "Gedung A, Lantai 1",
        "capacity": 30,
        "description": "Ruang untuk kegiatan kuliah.",
        "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
        "status": "ACTIVE",
        "activeUnits": 3
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

Respons memiliki exclusive.data dan quantity.data, masing-masing dengan total/page/limit. Status katalog memakai ACTIVE atau MAINTENANCE; fasilitas NONACTIVE tidak ditampilkan.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |

</details>

<details>
<summary><strong>GET /api/v1/facilities/:id/availability</strong></summary>

Ketersediaan slot satu unit atau kelompok pada tanggal tertentu.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| date | query | string | Ya | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| kind | query | 'unit' \| 'group' | Tidak | Pilihan: `unit`, `group` | unit |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/facilities/22222222-2222-4222-8222-222222222222/availability?date=2026-10-19&kind=unit"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "kind": "EXCLUSIVE",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "name": "Ruang Kelas 101",
  "date": "2026-10-19",
  "isOperationalDay": true,
  "slots": [
    {
      "slotIndex": 0,
      "startTime": "07:00",
      "endTime": "07:30",
      "available": true
    }
  ],
  "assetCode": "R-KLS-101"
}
```

**Varian kelompok alat (`kind=group` atau `facilityGroupId`)**

```json
{
  "kind": "QUANTITY",
  "facilityGroupId": "33333333-3333-4333-8333-333333333333",
  "name": "Proyektor Epson EB-X06",
  "date": "2026-10-19",
  "isOperationalDay": true,
  "slots": [
    {
      "slotIndex": 0,
      "startTime": "07:00",
      "endTime": "07:30",
      "available": true,
      "availableUnits": 3,
      "totalUnits": 3
    }
  ],
  "totalActiveUnits": 3
}
```

Respons penuh berisi 26 slot 30 menit pukul 07:00 sampai 20:00. Contoh hanya menampilkan satu slot. Untuk kind=group, respons memakai facilityGroupId, totalActiveUnits, serta availableUnits/totalUnits pada setiap slot. reason dapat berupa NON_OPERATIONAL_DAY, MAINTENANCE, RESERVED, atau OUT_OF_STOCK sesuai mode.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>GET /api/v1/facilities/:id</strong></summary>

Detail unit EXCLUSIVE atau kelompok QUANTITY sesuai kind.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| kind | query | unit / group | Tidak | Pilih jenis ID; validasi kind di controller ini tidak memakai DTO | unit |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/facilities/22222222-2222-4222-8222-222222222222?kind=unit"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "kind": "EXCLUSIVE",
  "id": "22222222-2222-4222-8222-222222222222",
  "assetCode": "R-KLS-101",
  "name": "Ruang Kelas 101",
  "facilityType": {
    "id": "44444444-4444-4444-8444-444444444444",
    "name": "Ruang Kelas"
  },
  "facilityArea": {
    "id": "55555555-5555-4555-8555-555555555555",
    "code": "TEMBALANG",
    "name": "Kampus Tembalang"
  },
  "locationDetail": "Gedung A, Lantai 1",
  "capacity": 30,
  "description": "Ruang untuk kegiatan kuliah.",
  "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
  "status": "ACTIVE",
  "nextMaintenance": {
    "startAt": "2026-10-19T02:00:00.000Z",
    "endAt": "2026-10-19T03:00:00.000Z"
  }
}
```

**Varian kelompok alat (`kind=group` atau `facilityGroupId`)**

```json
{
  "kind": "QUANTITY",
  "id": "33333333-3333-4333-8333-333333333333",
  "name": "Proyektor Epson EB-X06",
  "facilityType": {
    "id": "44444444-4444-4444-8444-444444444444",
    "name": "Peralatan"
  },
  "facilityArea": {
    "id": "55555555-5555-4555-8555-555555555555",
    "code": "TEMBALANG",
    "name": "Kampus Tembalang"
  },
  "locationDetail": "Gedung A, Lantai 1",
  "capacity": 30,
  "description": "Ruang untuk kegiatan kuliah.",
  "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
  "status": "ACTIVE",
  "activeUnits": 3,
  "nextMaintenance": {
    "startAt": "2026-10-19T02:00:00.000Z",
    "endAt": "2026-10-19T03:00:00.000Z"
  }
}
```

kind=unit (default) memakai ID unit EXCLUSIVE; kind=group memakai ID kelompok QUANTITY. nextMaintenance hanya muncul bila ada perbaikan mendatang.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>GET /api/v1/facilities/images/:fileName</strong></summary>

Mengalirkan foto utama fasilitas dari bucket private.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 200; file binary |
| Acuan | [Controller](unispace-backend/src/facilities/facility-images.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| fileName | path | string | Ya | Nama file UUID dengan ekstensi jpg/png/webp | - |

**Contoh request**

```bash
curl -sS -X GET "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp" \
  --output fasilitas.webp
```

**Respons file**

Content-Type mengikuti JPEG/PNG/WebP; Cache-Control: `public, max-age=86400`. Content-Length disertakan jika tersedia. Tidak ada envelope JSON.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 503 | OBJECT_STORAGE_UNAVAILABLE. |

</details>


### Master fasilitas admin


| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/v1/admin/facilities` | ADMIN | Daftar semua kelompok dan unit, termasuk fasilitas nonaktif. |
| POST | `/api/v1/admin/facilities/groups` | ADMIN | Membuat kelompok serta foto utama; EXCLUSIVE sekaligus membuat unit awal. |
| PATCH | `/api/v1/admin/facilities/groups/:id` | ADMIN | Memperbarui metadata/foto kelompok tanpa mengubah mode reservasi. |
| POST | `/api/v1/admin/facilities/units` | ADMIN | Menambah unit fisik berkode unik ke kelompok QUANTITY. |
| PATCH | `/api/v1/admin/facilities/units/:id` | ADMIN | Memperbarui kode aset atau metadata unit. |
| PATCH | `/api/v1/admin/facilities/units/:id/status` | ADMIN | Mengubah status tersimpan unit menjadi ACTIVE atau NONACTIVE. |
| GET | `/api/v1/admin/facilities/types` | ADMIN | Daftar seluruh tipe beserta jumlah kelompok yang menggunakannya. |
| POST | `/api/v1/admin/facilities/types` | ADMIN | Membuat tipe fasilitas aktif. |
| PATCH | `/api/v1/admin/facilities/types/:id` | ADMIN | Memperbarui nama tipe fasilitas. |
| PATCH | `/api/v1/admin/facilities/types/:id/status` | ADMIN | Mengaktifkan/menonaktifkan tipe fasilitas. |
| GET | `/api/v1/admin/facilities/areas` | ADMIN | Daftar seluruh area beserta jumlah kelompok yang menggunakannya. |
| POST | `/api/v1/admin/facilities/areas` | ADMIN | Membuat area kampus aktif. |
| PATCH | `/api/v1/admin/facilities/areas/:id` | ADMIN | Memperbarui kode/nama area kampus. |
| PATCH | `/api/v1/admin/facilities/areas/:id/status` | ADMIN | Mengaktifkan/menonaktifkan area kampus. |

<details>
<summary><strong>GET /api/v1/admin/facilities</strong></summary>

Daftar semua kelompok dan unit, termasuk fasilitas nonaktif.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/facilities" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
[
  {
    "id": "33333333-3333-4333-8333-333333333333",
    "name": "Ruang Kelas 101",
    "facilityTypeId": "44444444-4444-4444-8444-444444444444",
    "reservationMode": "EXCLUSIVE",
    "facilityAreaId": "55555555-5555-4555-8555-555555555555",
    "locationDetail": "Gedung A, Lantai 1",
    "capacity": 30,
    "description": "Ruang untuk kegiatan kuliah.",
    "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
    "primaryImageObjectKey": "facilities/22222222-2222-4222-8222-222222222222.webp",
    "facilityType": {
      "id": "44444444-4444-4444-8444-444444444444",
      "name": "Ruang Kelas"
    },
    "facilityArea": {
      "id": "55555555-5555-4555-8555-555555555555",
      "code": "TEMBALANG",
      "name": "Kampus Tembalang"
    },
    "facilities": [
      {
        "id": "22222222-2222-4222-8222-222222222222",
        "assetCode": "R-KLS-101",
        "name": "Ruang Kelas 101",
        "capacity": 30,
        "description": "Ruang untuk kegiatan kuliah.",
        "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
        "status": "ACTIVE",
        "createdAt": "2026-10-14T06:00:00.000Z"
      }
    ]
  }
]
```

| Status gagal utama | Kondisi |
|---|---|
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>POST /api/v1/admin/facilities/groups</strong></summary>

Membuat kelompok serta foto utama; EXCLUSIVE sekaligus membuat unit awal.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | multipart/form-data |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| name | form-data | string | Ya | Panjang maksimum 150; Tidak kosong | - |
| facilityTypeId | form-data | string (UUID) | Ya | Sesuai tipe; field lain di luar kontrak ditolak | - |
| reservationMode | form-data | ReservationMode | Ya | Pilihan: `EXCLUSIVE`, `QUANTITY` | - |
| facilityAreaId | form-data | string (UUID) | Ya | Sesuai tipe; field lain di luar kontrak ditolak | - |
| locationDetail | form-data | string | Ya | Panjang maksimum 500; Tidak kosong | - |
| capacity | form-data | integer | Tidak | Nilai minimum 0 | - |
| description | form-data | string | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| assetCode | form-data | string | Untuk EXCLUSIVE | Panjang maksimum 64 | - |
| primaryImage | form-data | file | Ya | Satu file; JPEG/PNG/WebP, maksimum 5 MB | - |

**Field teks multipart (representasi JSON, kirim sebagai form-data)**

```json
{
  "name": "Ruang Kelas 101",
  "facilityTypeId": "44444444-4444-4444-8444-444444444444",
  "reservationMode": "EXCLUSIVE",
  "facilityAreaId": "55555555-5555-4555-8555-555555555555",
  "locationDetail": "Gedung A, Lantai 1",
  "capacity": 30,
  "description": "Ruang untuk kegiatan kuliah.",
  "assetCode": "R-KLS-101"
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/admin/facilities/groups" \
  -H "Authorization: Bearer <accessToken>" \
  -F 'name=Ruang Kelas 101' \
  -F 'facilityTypeId=44444444-4444-4444-8444-444444444444' \
  -F 'reservationMode=EXCLUSIVE' \
  -F 'facilityAreaId=55555555-5555-4555-8555-555555555555' \
  -F 'locationDetail=Gedung A, Lantai 1' \
  -F 'capacity=30' \
  -F 'description=Ruang untuk kegiatan kuliah.' \
  -F 'assetCode=R-KLS-101' \
  -F "primaryImage=@fasilitas.webp"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "name": "Ruang Kelas 101",
  "facilityTypeId": "44444444-4444-4444-8444-444444444444",
  "reservationMode": "EXCLUSIVE",
  "facilityAreaId": "55555555-5555-4555-8555-555555555555",
  "locationDetail": "Gedung A, Lantai 1",
  "capacity": 30,
  "description": "Ruang untuk kegiatan kuliah.",
  "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
  "primaryImageObjectKey": "facilities/22222222-2222-4222-8222-222222222222.webp",
  "facilityType": {
    "id": "44444444-4444-4444-8444-444444444444",
    "name": "Ruang Kelas"
  },
  "facilityArea": {
    "id": "55555555-5555-4555-8555-555555555555",
    "code": "TEMBALANG",
    "name": "Kampus Tembalang"
  },
  "initialUnit": {
    "id": "22222222-2222-4222-8222-222222222222",
    "facilityGroupId": "33333333-3333-4333-8333-333333333333",
    "assetCode": "R-KLS-101",
    "name": "Ruang Kelas 101",
    "capacity": 30,
    "description": "Ruang untuk kegiatan kuliah.",
    "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
    "primaryImageObjectKey": "facilities/22222222-2222-4222-8222-222222222222.webp",
    "status": "ACTIVE",
    "createdAt": "2026-10-14T06:00:00.000Z",
    "updatedAt": "2026-10-14T06:00:00.000Z"
  }
}
```

primaryImage wajib pada kedua mode. EXCLUSIVE mewajibkan assetCode dan membuat initialUnit; QUANTITY mengembalikan initialUnit=null dan unit ditambah melalui POST /admin/facilities/units.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 409 | Kode aset, kode area, atau nama master melanggar keunikan. |
| 413 | Foto lebih besar dari 5 MB. |
| 503 | Object storage tidak tersedia bila error storage dipetakan oleh service. |

</details>

<details>
<summary><strong>PATCH /api/v1/admin/facilities/groups/:id</strong></summary>

Memperbarui metadata/foto kelompok tanpa mengubah mode reservasi.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | multipart/form-data atau application/json tanpa file |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| name | form-data | string | Tidak | Panjang maksimum 150 | - |
| facilityTypeId | form-data | string (UUID) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityAreaId | form-data | string (UUID) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| locationDetail | form-data | string | Tidak | Panjang maksimum 500 | - |
| capacity | form-data | integer | Tidak | Nilai minimum 0 | - |
| description | form-data | string | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| primaryImage | form-data | file | Tidak | Satu file; JPEG/PNG/WebP, maksimum 5 MB | - |

**Field teks multipart (representasi JSON, kirim sebagai form-data)**

```json
{
  "name": "Ruang Kelas 101",
  "facilityTypeId": "44444444-4444-4444-8444-444444444444",
  "facilityAreaId": "55555555-5555-4555-8555-555555555555",
  "locationDetail": "Gedung A, Lantai 1",
  "capacity": 30,
  "description": "Ruang untuk kegiatan kuliah."
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/admin/facilities/groups/33333333-3333-4333-8333-333333333333" \
  -H "Authorization: Bearer <accessToken>" \
  -F 'name=Ruang Kelas 101' \
  -F 'facilityTypeId=44444444-4444-4444-8444-444444444444' \
  -F 'facilityAreaId=55555555-5555-4555-8555-555555555555' \
  -F 'locationDetail=Gedung A, Lantai 1' \
  -F 'capacity=30' \
  -F 'description=Ruang untuk kegiatan kuliah.' \
  -F "primaryImage=@fasilitas.webp"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "name": "Ruang Kelas 101",
  "facilityTypeId": "44444444-4444-4444-8444-444444444444",
  "reservationMode": "EXCLUSIVE",
  "facilityAreaId": "55555555-5555-4555-8555-555555555555",
  "locationDetail": "Gedung A, Lantai 1",
  "capacity": 30,
  "description": "Ruang untuk kegiatan kuliah.",
  "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
  "primaryImageObjectKey": "facilities/22222222-2222-4222-8222-222222222222.webp",
  "facilityType": {
    "id": "44444444-4444-4444-8444-444444444444",
    "name": "Ruang Kelas"
  },
  "facilityArea": {
    "id": "55555555-5555-4555-8555-555555555555",
    "code": "TEMBALANG",
    "name": "Kampus Tembalang"
  }
}
```

Semua field metadata opsional. reservationMode tidak boleh dikirim. Pada EXCLUSIVE, perubahan metadata kelompok juga disinkronkan ke unit ruang.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 413 | Foto lebih besar dari 5 MB. |
| 503 | Object storage tidak tersedia bila error storage dipetakan oleh service. |

</details>

<details>
<summary><strong>POST /api/v1/admin/facilities/units</strong></summary>

Menambah unit fisik berkode unik ke kelompok QUANTITY.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| facilityGroupId | body | string (UUID) | Ya | Sesuai tipe; field lain di luar kontrak ditolak | - |
| assetCode | body | string | Ya | Panjang maksimum 64; Tidak kosong | - |
| name | body | string | Tidak | Panjang maksimum 150 | - |

**Contoh body JSON**

```json
{
  "facilityGroupId": "33333333-3333-4333-8333-333333333333",
  "assetCode": "PRJ-001"
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/admin/facilities/units" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"facilityGroupId":"33333333-3333-4333-8333-333333333333","assetCode":"PRJ-001"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": "33333333-3333-4333-8333-333333333333",
  "assetCode": "PRJ-001",
  "name": null,
  "capacity": null,
  "description": null,
  "primaryImageUrl": null,
  "primaryImageObjectKey": null,
  "status": "ACTIVE",
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

Hanya kelompok QUANTITY yang menerima unit tambahan. Metadata katalog alat dibaca dari kelompoknya.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 409 | Kode aset, kode area, atau nama master melanggar keunikan. |

</details>

<details>
<summary><strong>PATCH /api/v1/admin/facilities/units/:id</strong></summary>

Memperbarui kode aset atau metadata unit.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | multipart/form-data atau application/json tanpa file |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| assetCode | form-data | string | Tidak | Panjang maksimum 64; Tidak kosong | - |
| name | form-data | string | Tidak | Panjang maksimum 150; Tidak kosong | - |
| capacity | form-data | integer | Tidak | Nilai minimum 0 | - |
| description | form-data | string | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| primaryImage | form-data | file | Tidak | Satu file; JPEG/PNG/WebP, maksimum 5 MB | - |

**Field teks multipart (representasi JSON, kirim sebagai form-data)**

```json
{
  "assetCode": "R-KLS-101",
  "name": "Ruang Kelas 101",
  "capacity": 30,
  "description": "Ruang untuk kegiatan kuliah."
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/admin/facilities/units/22222222-2222-4222-8222-222222222222" \
  -H "Authorization: Bearer <accessToken>" \
  -F 'assetCode=R-KLS-101' \
  -F 'name=Ruang Kelas 101' \
  -F 'capacity=30' \
  -F 'description=Ruang untuk kegiatan kuliah.' \
  -F "primaryImage=@fasilitas.webp"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": "33333333-3333-4333-8333-333333333333",
  "assetCode": "R-KLS-101",
  "name": "Ruang Kelas 101",
  "capacity": 30,
  "description": "Ruang untuk kegiatan kuliah.",
  "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
  "primaryImageObjectKey": "facilities/22222222-2222-4222-8222-222222222222.webp",
  "status": "ACTIVE",
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

Pada QUANTITY, capacity, description, dan primaryImage ditolak; metadata tersebut diubah pada kelompok. name masih tersedia pada DTO unit.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Kode aset, kode area, atau nama master melanggar keunikan. |
| 413 | Foto lebih besar dari 5 MB. |
| 503 | Object storage tidak tersedia bila error storage dipetakan oleh service. |

</details>

<details>
<summary><strong>PATCH /api/v1/admin/facilities/units/:id/status</strong></summary>

Mengubah status tersimpan unit menjadi ACTIVE atau NONACTIVE.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| status | body | FacilityStatus | Ya | ACTIVE atau NONACTIVE | - |

**Contoh body JSON**

```json
{
  "status": "NONACTIVE"
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/admin/facilities/units/22222222-2222-4222-8222-222222222222/status" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"status":"NONACTIVE"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": "33333333-3333-4333-8333-333333333333",
  "assetCode": "R-KLS-101",
  "name": "Ruang Kelas 101",
  "capacity": 30,
  "description": "Ruang untuk kegiatan kuliah.",
  "primaryImageUrl": "http://localhost:3001/api/v1/facilities/images/22222222-2222-4222-8222-222222222222.webp",
  "primaryImageObjectKey": "facilities/22222222-2222-4222-8222-222222222222.webp",
  "status": "NONACTIVE",
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z",
  "facilityGroup": {
    "name": "Ruang Kelas 101",
    "reservationMode": "EXCLUSIVE"
  }
}
```

NONACTIVE ditolak bila unit masih terkait APPROVED yang belum selesai. PENDING yang tidak lagi dapat dipenuhi ditolak. Respons status adalah status tersimpan; katalog menghitung kondisi maintenance dari periode.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>GET /api/v1/admin/facilities/types</strong></summary>

Daftar seluruh tipe beserta jumlah kelompok yang menggunakannya.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/facilities/types" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
[
  {
    "id": "44444444-4444-4444-8444-444444444444",
    "name": "Ruang Kelas",
    "status": "ACTIVE",
    "_count": {
      "facilityGroups": 0
    }
  }
]
```

| Status gagal utama | Kondisi |
|---|---|
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>POST /api/v1/admin/facilities/types</strong></summary>

Membuat tipe fasilitas aktif.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| name | body | string | Ya | Panjang maksimum 100; Tidak kosong | - |

**Contoh body JSON**

```json
{
  "name": "Ruang Kelas"
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/admin/facilities/types" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"name":"Ruang Kelas"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "name": "Ruang Kelas",
  "status": "ACTIVE"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 409 | Kode aset, kode area, atau nama master melanggar keunikan. |

</details>

<details>
<summary><strong>PATCH /api/v1/admin/facilities/types/:id</strong></summary>

Memperbarui nama tipe fasilitas.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| name | body | string | Tidak | Panjang maksimum 100; Tidak kosong | - |

**Contoh body JSON**

```json
{
  "name": "Ruang Kelas"
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/admin/facilities/types/44444444-4444-4444-8444-444444444444" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"name":"Ruang Kelas"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "name": "Ruang Kelas",
  "status": "ACTIVE"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Kode aset, kode area, atau nama master melanggar keunikan. |

</details>

<details>
<summary><strong>PATCH /api/v1/admin/facilities/types/:id/status</strong></summary>

Mengaktifkan/menonaktifkan tipe fasilitas.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| status | body | FacilityTypeStatus | Ya | Pilihan: `ACTIVE`, `NONACTIVE` | - |

**Contoh body JSON**

```json
{
  "status": "NONACTIVE"
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/admin/facilities/types/44444444-4444-4444-8444-444444444444/status" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"status":"NONACTIVE"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "name": "Ruang Kelas",
  "status": "NONACTIVE",
  "_count": {
    "facilityGroups": 0
  }
}
```

Tipe tidak dapat dinonaktifkan selama masih dipakai oleh kelompok fasilitas.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | FACILITY_TYPE_STILL_REFERENCED. |

</details>

<details>
<summary><strong>GET /api/v1/admin/facilities/areas</strong></summary>

Daftar seluruh area beserta jumlah kelompok yang menggunakannya.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/facilities/areas" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
[
  {
    "id": "55555555-5555-4555-8555-555555555555",
    "code": "TEMBALANG",
    "name": "Kampus Tembalang",
    "status": "ACTIVE",
    "createdAt": "2026-10-14T06:00:00.000Z",
    "updatedAt": "2026-10-14T06:00:00.000Z",
    "_count": {
      "facilityGroups": 0
    }
  }
]
```

| Status gagal utama | Kondisi |
|---|---|
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>POST /api/v1/admin/facilities/areas</strong></summary>

Membuat area kampus aktif.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| code | body | string | Ya | Tidak kosong; 2 sampai 30 huruf kapital, angka, atau underscore; diubah ke kapital | - |
| name | body | string | Ya | Panjang minimum 2; Panjang maksimum 120; Tidak kosong | - |

**Contoh body JSON**

```json
{
  "code": "TEMBALANG",
  "name": "Kampus Tembalang"
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/admin/facilities/areas" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"code":"TEMBALANG","name":"Kampus Tembalang"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "55555555-5555-4555-8555-555555555555",
  "code": "TEMBALANG",
  "name": "Kampus Tembalang",
  "status": "ACTIVE",
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 409 | Kode aset, kode area, atau nama master melanggar keunikan. |

</details>

<details>
<summary><strong>PATCH /api/v1/admin/facilities/areas/:id</strong></summary>

Memperbarui kode/nama area kampus.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| code | body | string | Tidak | Tidak kosong; 2 sampai 30 huruf kapital, angka, atau underscore; diubah ke kapital | - |
| name | body | string | Tidak | Panjang minimum 2; Panjang maksimum 120; Tidak kosong | - |

**Contoh body JSON**

```json
{
  "code": "TEMBALANG",
  "name": "Kampus Tembalang"
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/admin/facilities/areas/55555555-5555-4555-8555-555555555555" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"code":"TEMBALANG","name":"Kampus Tembalang"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "55555555-5555-4555-8555-555555555555",
  "code": "TEMBALANG",
  "name": "Kampus Tembalang",
  "status": "ACTIVE",
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Kode aset, kode area, atau nama master melanggar keunikan. |

</details>

<details>
<summary><strong>PATCH /api/v1/admin/facilities/areas/:id/status</strong></summary>

Mengaktifkan/menonaktifkan area kampus.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/admin-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| status | body | FacilityAreaStatus | Ya | Pilihan: `ACTIVE`, `NONACTIVE` | - |

**Contoh body JSON**

```json
{
  "status": "NONACTIVE"
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/admin/facilities/areas/55555555-5555-4555-8555-555555555555/status" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"status":"NONACTIVE"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "55555555-5555-4555-8555-555555555555",
  "code": "TEMBALANG",
  "name": "Kampus Tembalang",
  "status": "NONACTIVE",
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

Area tidak dapat dinonaktifkan selama masih mempunyai kelompok fasilitas; pindahkan kelompok terlebih dahulu.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | FACILITY_AREA_STILL_REFERENCED. |

</details>


### Reservasi pengguna


| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/v1/reservations/availability` | Publik | Ketersediaan publik melalui query target dan tanggal penggunaan. |
| GET | `/api/v1/reservations/my` | USER | Daftar reservasi milik pengguna yang login. |
| GET | `/api/v1/reservations/my/:id` | USER | Detail reservasi sendiri beserta aset dan kemampuan pembatalan. |
| GET | `/api/v1/reservations/:id` | USER | Alias detail reservasi sendiri, sama dengan GET /reservations/my/:id. |
| PATCH | `/api/v1/reservations/my/:id/cancel` | USER | Membatalkan reservasi sendiri sebelum batas H-1. |
| PATCH | `/api/v1/reservations/:id/cancel` | USER | Alias pembatalan sendiri, sama dengan PATCH /reservations/my/:id/cancel. |
| POST | `/api/v1/reservations` | USER | Mengajukan satu reservasi ruang atau kelompok alat. |

<details>
<summary><strong>GET /api/v1/reservations/availability</strong></summary>

Ketersediaan publik melalui query target dan tanggal penggunaan.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| facilityId | query | string (UUID v4) | Salah satu | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityGroupId | query | string (UUID v4) | Salah satu | Sesuai tipe; field lain di luar kontrak ditolak | - |
| usageDate | query | string | Ya | Tidak kosong; Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/reservations/availability?facilityId=22222222-2222-4222-8222-222222222222&usageDate=2026-10-19"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "kind": "EXCLUSIVE",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "name": "Ruang Kelas 101",
  "date": "2026-10-19",
  "isOperationalDay": true,
  "slots": [
    {
      "slotIndex": 0,
      "startTime": "07:00",
      "endTime": "07:30",
      "available": true
    }
  ],
  "assetCode": "R-KLS-101"
}
```

**Varian kelompok alat (`kind=group` atau `facilityGroupId`)**

```json
{
  "kind": "QUANTITY",
  "facilityGroupId": "33333333-3333-4333-8333-333333333333",
  "name": "Proyektor Epson EB-X06",
  "date": "2026-10-19",
  "isOperationalDay": true,
  "slots": [
    {
      "slotIndex": 0,
      "startTime": "07:00",
      "endTime": "07:30",
      "available": true,
      "availableUnits": 3,
      "totalUnits": 3
    }
  ],
  "totalActiveUnits": 3
}
```

Kirim tepat satu facilityId atau facilityGroupId. usageDate memakai YYYY-MM-DD. Bentuk respons sama dengan availability pada katalog; contoh hanya menampilkan satu dari 26 slot.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |

</details>

<details>
<summary><strong>GET /api/v1/reservations/my</strong></summary>

Daftar reservasi milik pengguna yang login.

| Properti | Nilai |
|---|---|
| Akses | USER |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| status | query | ReservationStatus | Tidak | Pilihan: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED_BY_USER`, `CANCELLED_BY_STAFF`, `CANCELLED_BY_SYSTEM`, `COMPLETED` | - |
| view | query | 'HISTORY' | Tidak | Pilihan: `HISTORY` | - |
| usageDate | query | string | Tidak | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 50 | 10 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/reservations/my?status=PENDING&usageDate=2026-10-19&page=1&limit=10" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "data": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "reservationNumber": "RSV-20261014060000-ABC123",
      "userId": "11111111-1111-4111-8111-111111111111",
      "facilityId": "22222222-2222-4222-8222-222222222222",
      "facilityGroupId": null,
      "requestedQuantity": 1,
      "usageDate": "2026-10-19T00:00:00.000Z",
      "startTime": "1970-01-01T09:00:00.000Z",
      "endTime": "1970-01-01T10:00:00.000Z",
      "purpose": "Diskusi kelompok",
      "status": "PENDING",
      "decisionDeadline": "2026-10-15T13:00:00.000Z",
      "decisionReason": null,
      "processedById": null,
      "decidedAt": null,
      "cancelledAt": null,
      "createdAt": "2026-10-14T06:00:00.000Z",
      "updatedAt": "2026-10-14T06:00:00.000Z",
      "facility": {
        "id": "22222222-2222-4222-8222-222222222222",
        "name": "Ruang Kelas 101",
        "assetCode": "R-KLS-101",
        "facilityGroup": {
          "id": "33333333-3333-4333-8333-333333333333",
          "name": "Ruang Kelas 101",
          "locationDetail": "Gedung A, Lantai 1",
          "facilityArea": {
            "id": "55555555-5555-4555-8555-555555555555",
            "code": "TEMBALANG",
            "name": "Kampus Tembalang"
          },
          "facilityType": {
            "id": "44444444-4444-4444-8444-444444444444",
            "name": "Ruang Kelas"
          }
        }
      },
      "facilityGroup": null,
      "items": [],
      "allocatedAssets": [],
      "canCancel": true
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

view=HISTORY memilih status terminal. Pagination memakai data dan meta. canCancel dihitung dari status dan waktu saat request; jangan menganggap nilai contoh selalu berlaku.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/reservations/my/:id</strong></summary>

Detail reservasi sendiri beserta aset dan kemampuan pembatalan.

| Properti | Nilai |
|---|---|
| Akses | USER |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/reservations/my/66666666-6666-4666-8666-666666666666" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "reservationNumber": "RSV-20261014060000-ABC123",
  "userId": "11111111-1111-4111-8111-111111111111",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": null,
  "requestedQuantity": 1,
  "usageDate": "2026-10-19T00:00:00.000Z",
  "startTime": "1970-01-01T09:00:00.000Z",
  "endTime": "1970-01-01T10:00:00.000Z",
  "purpose": "Diskusi kelompok",
  "status": "PENDING",
  "decisionDeadline": "2026-10-15T13:00:00.000Z",
  "decisionReason": null,
  "processedById": null,
  "decidedAt": null,
  "cancelledAt": null,
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z",
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "Ruang Kelas 101",
    "assetCode": "R-KLS-101",
    "facilityGroup": {
      "id": "33333333-3333-4333-8333-333333333333",
      "name": "Ruang Kelas 101",
      "locationDetail": "Gedung A, Lantai 1",
      "facilityArea": {
        "id": "55555555-5555-4555-8555-555555555555",
        "code": "TEMBALANG",
        "name": "Kampus Tembalang"
      },
      "facilityType": {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Ruang Kelas"
      }
    }
  },
  "facilityGroup": null,
  "items": [],
  "allocatedAssets": [],
  "canCancel": true,
  "processedBy": null
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>GET /api/v1/reservations/:id</strong></summary>

Alias detail reservasi sendiri, sama dengan GET /reservations/my/:id.

| Properti | Nilai |
|---|---|
| Akses | USER |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/reservations/66666666-6666-4666-8666-666666666666" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "reservationNumber": "RSV-20261014060000-ABC123",
  "userId": "11111111-1111-4111-8111-111111111111",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": null,
  "requestedQuantity": 1,
  "usageDate": "2026-10-19T00:00:00.000Z",
  "startTime": "1970-01-01T09:00:00.000Z",
  "endTime": "1970-01-01T10:00:00.000Z",
  "purpose": "Diskusi kelompok",
  "status": "PENDING",
  "decisionDeadline": "2026-10-15T13:00:00.000Z",
  "decisionReason": null,
  "processedById": null,
  "decidedAt": null,
  "cancelledAt": null,
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z",
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "Ruang Kelas 101",
    "assetCode": "R-KLS-101",
    "facilityGroup": {
      "id": "33333333-3333-4333-8333-333333333333",
      "name": "Ruang Kelas 101",
      "locationDetail": "Gedung A, Lantai 1",
      "facilityArea": {
        "id": "55555555-5555-4555-8555-555555555555",
        "code": "TEMBALANG",
        "name": "Kampus Tembalang"
      },
      "facilityType": {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Ruang Kelas"
      }
    }
  },
  "facilityGroup": null,
  "items": [],
  "allocatedAssets": [],
  "canCancel": true,
  "processedBy": null
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>PATCH /api/v1/reservations/my/:id/cancel</strong></summary>

Membatalkan reservasi sendiri sebelum batas H-1.

| Properti | Nilai |
|---|---|
| Akses | USER |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/reservations/my/66666666-6666-4666-8666-666666666666/cancel" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "reservationNumber": "RSV-20261014060000-ABC123",
  "userId": "11111111-1111-4111-8111-111111111111",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": null,
  "requestedQuantity": 1,
  "usageDate": "2026-10-19T00:00:00.000Z",
  "startTime": "1970-01-01T09:00:00.000Z",
  "endTime": "1970-01-01T10:00:00.000Z",
  "purpose": "Diskusi kelompok",
  "status": "CANCELLED_BY_USER",
  "decisionDeadline": "2026-10-15T13:00:00.000Z",
  "decisionReason": null,
  "processedById": null,
  "decidedAt": null,
  "cancelledAt": "2026-10-14T06:00:00.000Z",
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

Hanya PENDING/APPROVED milik sendiri hingga pukul 20:00 H-1 hari operasional. Body tidak diperlukan. Respons pembatalan adalah scalar Reservation tanpa objek relasi.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>PATCH /api/v1/reservations/:id/cancel</strong></summary>

Alias pembatalan sendiri, sama dengan PATCH /reservations/my/:id/cancel.

| Properti | Nilai |
|---|---|
| Akses | USER |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/reservations/66666666-6666-4666-8666-666666666666/cancel" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "reservationNumber": "RSV-20261014060000-ABC123",
  "userId": "11111111-1111-4111-8111-111111111111",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": null,
  "requestedQuantity": 1,
  "usageDate": "2026-10-19T00:00:00.000Z",
  "startTime": "1970-01-01T09:00:00.000Z",
  "endTime": "1970-01-01T10:00:00.000Z",
  "purpose": "Diskusi kelompok",
  "status": "CANCELLED_BY_USER",
  "decisionDeadline": "2026-10-15T13:00:00.000Z",
  "decisionReason": null,
  "processedById": null,
  "decidedAt": null,
  "cancelledAt": "2026-10-14T06:00:00.000Z",
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

Aturan dan respons sama dengan cancelMy; body tidak diperlukan.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>POST /api/v1/reservations</strong></summary>

Mengajukan satu reservasi ruang atau kelompok alat.

| Properti | Nilai |
|---|---|
| Akses | USER |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| facilityId | body | string (UUID v4) | Salah satu | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityGroupId | body | string (UUID v4) | Salah satu | Sesuai tipe; field lain di luar kontrak ditolak | - |
| requestedQuantity | body | integer | Tidak | Nilai minimum 1 | 1 |
| usageDate | body | string | Ya | Tidak kosong; Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| startTime | body | string | Ya | Tidak kosong; HH:mm; service membatasi slot 30 menit pukul 07:00 sampai 20:00 | - |
| endTime | body | string | Ya | Tidak kosong; HH:mm; service membatasi slot 30 menit pukul 07:00 sampai 20:00 | - |
| purpose | body | string | Ya | Panjang maksimum 500; Tidak kosong | - |

**Contoh body JSON**

```json
{
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "requestedQuantity": 1,
  "usageDate": "2026-10-19",
  "startTime": "09:00",
  "endTime": "10:00",
  "purpose": "Diskusi kelompok"
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/reservations" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"facilityId":"22222222-2222-4222-8222-222222222222","requestedQuantity":1,"usageDate":"2026-10-19","startTime":"09:00","endTime":"10:00","purpose":"Diskusi kelompok"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "reservationNumber": "RSV-20261014060000-ABC123",
  "userId": "11111111-1111-4111-8111-111111111111",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": null,
  "requestedQuantity": 1,
  "usageDate": "2026-10-19T00:00:00.000Z",
  "startTime": "1970-01-01T09:00:00.000Z",
  "endTime": "1970-01-01T10:00:00.000Z",
  "purpose": "Diskusi kelompok",
  "status": "PENDING",
  "decisionDeadline": "2026-10-15T13:00:00.000Z",
  "decisionReason": null,
  "processedById": null,
  "decidedAt": null,
  "cancelledAt": null,
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z",
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "Ruang Kelas 101",
    "assetCode": "R-KLS-101"
  },
  "facilityGroup": null
}
```

**Alternatif body peminjaman kelompok alat QUANTITY**

```json
{
  "facilityGroupId": "33333333-3333-4333-8333-333333333333",
  "requestedQuantity": 2,
  "usageDate": "2026-10-19",
  "startTime": "09:00",
  "endTime": "10:00",
  "purpose": "Presentasi kelompok"
}
```

Kirim tepat satu target. EXCLUSIVE memakai requestedQuantity=1; QUANTITY memilih jumlah unit. Hari kerja, H-2, maksimum 14 hari kalender, slot 30 menit, serta tujuan maksimum 500 karakter diperiksa kembali backend.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>


### Reservasi petugas


| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/v1/staff/reservations` | STAFF | Antrean reservasi dengan filter operasional. |
| GET | `/api/v1/staff/reservations/:id` | STAFF | Detail reservasi untuk petugas. |
| PATCH | `/api/v1/staff/reservations/:id/approve` | STAFF | Menyetujui PENDING, memeriksa bentrok, dan mengalokasikan aset otomatis. |
| PATCH | `/api/v1/staff/reservations/:id/reject` | STAFF | Menolak PENDING dengan alasan wajib. |
| PATCH | `/api/v1/staff/reservations/:id/cancel` | STAFF | Membatalkan APPROVED dengan alasan wajib. |
| POST | `/api/v1/staff/reservations/auto-reject-expired` | STAFF | Menjalankan pemeriksaan manual SLA dan menolak PENDING kedaluwarsa. |

<details>
<summary><strong>GET /api/v1/staff/reservations</strong></summary>

Antrean reservasi dengan filter operasional.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/staff-reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| status | query | ReservationStatus | Tidak | Pilihan: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED_BY_USER`, `CANCELLED_BY_STAFF`, `CANCELLED_BY_SYSTEM`, `COMPLETED` | - |
| view | query | 'CANCELLED' | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| usageDate | query | string | Tidak | Tanggal ISO 8601; YYYY-MM-DD | - |
| facilityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityGroupId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityAreaId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| search | query | string | Tidak | Panjang maksimum 320 | - |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 100 | 10 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/staff/reservations?status=PENDING&usageDate=2026-10-19&page=1&limit=10" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "data": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "reservationNumber": "RSV-20261014060000-ABC123",
      "userId": "11111111-1111-4111-8111-111111111111",
      "facilityId": "22222222-2222-4222-8222-222222222222",
      "facilityGroupId": null,
      "requestedQuantity": 1,
      "usageDate": "2026-10-19T00:00:00.000Z",
      "startTime": "1970-01-01T09:00:00.000Z",
      "endTime": "1970-01-01T10:00:00.000Z",
      "purpose": "Diskusi kelompok",
      "status": "PENDING",
      "decisionDeadline": "2026-10-15T13:00:00.000Z",
      "decisionReason": null,
      "processedById": null,
      "decidedAt": null,
      "cancelledAt": null,
      "createdAt": "2026-10-14T06:00:00.000Z",
      "updatedAt": "2026-10-14T06:00:00.000Z",
      "facility": {
        "id": "22222222-2222-4222-8222-222222222222",
        "name": "Ruang Kelas 101",
        "assetCode": "R-KLS-101",
        "facilityGroup": {
          "id": "33333333-3333-4333-8333-333333333333",
          "name": "Ruang Kelas 101",
          "locationDetail": "Gedung A, Lantai 1",
          "facilityArea": {
            "id": "55555555-5555-4555-8555-555555555555",
            "code": "TEMBALANG",
            "name": "Kampus Tembalang"
          },
          "facilityType": {
            "id": "44444444-4444-4444-8444-444444444444",
            "name": "Ruang Kelas"
          }
        }
      },
      "facilityGroup": null,
      "items": [],
      "allocatedAssets": [],
      "user": {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Pengguna Demo 01",
        "email": "user1@unispace.local",
        "identityNumber": "24060001"
      },
      "processedBy": null
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

view=CANCELLED memilih kelompok status pembatalan. Antrean PENDING diurutkan menurut tenggat keputusan. Pagination memakai data dan meta.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/staff/reservations/:id</strong></summary>

Detail reservasi untuk petugas.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/staff-reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/staff/reservations/66666666-6666-4666-8666-666666666666" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "reservationNumber": "RSV-20261014060000-ABC123",
  "userId": "11111111-1111-4111-8111-111111111111",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": null,
  "requestedQuantity": 1,
  "usageDate": "2026-10-19T00:00:00.000Z",
  "startTime": "1970-01-01T09:00:00.000Z",
  "endTime": "1970-01-01T10:00:00.000Z",
  "purpose": "Diskusi kelompok",
  "status": "PENDING",
  "decisionDeadline": "2026-10-15T13:00:00.000Z",
  "decisionReason": null,
  "processedById": null,
  "decidedAt": null,
  "cancelledAt": null,
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z",
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "Ruang Kelas 101",
    "assetCode": "R-KLS-101",
    "facilityGroup": {
      "id": "33333333-3333-4333-8333-333333333333",
      "name": "Ruang Kelas 101",
      "locationDetail": "Gedung A, Lantai 1",
      "facilityArea": {
        "id": "55555555-5555-4555-8555-555555555555",
        "code": "TEMBALANG",
        "name": "Kampus Tembalang"
      },
      "facilityType": {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Ruang Kelas"
      }
    }
  },
  "facilityGroup": null,
  "items": [],
  "allocatedAssets": [],
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "email": "user1@unispace.local",
    "identityNumber": "24060001"
  },
  "processedBy": null
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>PATCH /api/v1/staff/reservations/:id/approve</strong></summary>

Menyetujui PENDING, memeriksa bentrok, dan mengalokasikan aset otomatis.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/staff-reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| allocatedAssetIds | body | string[] | Tidak | Opsional; nilainya diabaikan backend | - |

**Contoh body JSON**

```json
{}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/staff/reservations/66666666-6666-4666-8666-666666666666/approve" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "reservationNumber": "RSV-20261014060000-ABC123",
  "userId": "11111111-1111-4111-8111-111111111111",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": null,
  "requestedQuantity": 1,
  "usageDate": "2026-10-19T00:00:00.000Z",
  "startTime": "1970-01-01T09:00:00.000Z",
  "endTime": "1970-01-01T10:00:00.000Z",
  "purpose": "Diskusi kelompok",
  "status": "APPROVED",
  "decisionDeadline": "2026-10-15T13:00:00.000Z",
  "decisionReason": null,
  "processedById": "99999999-9999-4999-8999-999999999999",
  "decidedAt": "2026-10-14T06:00:00.000Z",
  "cancelledAt": null,
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z",
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "Ruang Kelas 101",
    "assetCode": "R-KLS-101",
    "facilityGroup": {
      "id": "33333333-3333-4333-8333-333333333333",
      "name": "Ruang Kelas 101",
      "locationDetail": "Gedung A, Lantai 1",
      "facilityArea": {
        "id": "55555555-5555-4555-8555-555555555555",
        "code": "TEMBALANG",
        "name": "Kampus Tembalang"
      },
      "facilityType": {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Ruang Kelas"
      }
    }
  },
  "facilityGroup": null,
  "items": [],
  "allocatedAssets": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "assetCode": "R-KLS-101",
      "name": "Ruang Kelas 101"
    }
  ],
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "email": "user1@unispace.local",
    "identityNumber": "24060001"
  },
  "processedBy": {
    "id": "99999999-9999-4999-8999-999999999999",
    "name": "Aulia Pratama",
    "email": "staff1@unispace.local"
  }
}
```

Body {} dapat digunakan. allocatedAssetIds bersifat opsional untuk kompatibilitas dan nilainya diabaikan; backend memilih aset bebas otomatis. PENDING yang bertabrakan/tidak cukup stok ditolak.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>PATCH /api/v1/staff/reservations/:id/reject</strong></summary>

Menolak PENDING dengan alasan wajib.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/staff-reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| reason | body | string | Ya | Panjang minimum 5; Panjang maksimum 1000; Tidak kosong | - |

**Contoh body JSON**

```json
{
  "reason": "Jadwal tidak dapat disetujui."
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/staff/reservations/66666666-6666-4666-8666-666666666666/reject" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"reason":"Jadwal tidak dapat disetujui."}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "reservationNumber": "RSV-20261014060000-ABC123",
  "userId": "11111111-1111-4111-8111-111111111111",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": null,
  "requestedQuantity": 1,
  "usageDate": "2026-10-19T00:00:00.000Z",
  "startTime": "1970-01-01T09:00:00.000Z",
  "endTime": "1970-01-01T10:00:00.000Z",
  "purpose": "Diskusi kelompok",
  "status": "REJECTED",
  "decisionDeadline": "2026-10-15T13:00:00.000Z",
  "decisionReason": "Jadwal tidak dapat disetujui.",
  "processedById": "99999999-9999-4999-8999-999999999999",
  "decidedAt": "2026-10-14T06:00:00.000Z",
  "cancelledAt": null,
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z",
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "Ruang Kelas 101",
    "assetCode": "R-KLS-101",
    "facilityGroup": {
      "id": "33333333-3333-4333-8333-333333333333",
      "name": "Ruang Kelas 101",
      "locationDetail": "Gedung A, Lantai 1",
      "facilityArea": {
        "id": "55555555-5555-4555-8555-555555555555",
        "code": "TEMBALANG",
        "name": "Kampus Tembalang"
      },
      "facilityType": {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Ruang Kelas"
      }
    }
  },
  "facilityGroup": null,
  "items": [],
  "allocatedAssets": [],
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "email": "user1@unispace.local",
    "identityNumber": "24060001"
  },
  "processedBy": {
    "id": "99999999-9999-4999-8999-999999999999",
    "name": "Aulia Pratama",
    "email": "staff1@unispace.local"
  }
}
```

Kirim field reason, dipangkas dan panjang 5 sampai 1000 karakter. Gunakan nama field ini agar lolos validasi whitelist.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>PATCH /api/v1/staff/reservations/:id/cancel</strong></summary>

Membatalkan APPROVED dengan alasan wajib.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/staff-reservations.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| id | path | string (UUID) | Ya | ID sesuai entitas | - |
| reason | body | string | Ya | Panjang minimum 5; Panjang maksimum 1000; Tidak kosong | - |

**Contoh body JSON**

```json
{
  "reason": "Jadwal tidak dapat disetujui."
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/staff/reservations/66666666-6666-4666-8666-666666666666/cancel" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"reason":"Jadwal tidak dapat disetujui."}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "reservationNumber": "RSV-20261014060000-ABC123",
  "userId": "11111111-1111-4111-8111-111111111111",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "facilityGroupId": null,
  "requestedQuantity": 1,
  "usageDate": "2026-10-19T00:00:00.000Z",
  "startTime": "1970-01-01T09:00:00.000Z",
  "endTime": "1970-01-01T10:00:00.000Z",
  "purpose": "Diskusi kelompok",
  "status": "CANCELLED_BY_STAFF",
  "decisionDeadline": "2026-10-15T13:00:00.000Z",
  "decisionReason": "Fasilitas memerlukan perbaikan.",
  "processedById": "99999999-9999-4999-8999-999999999999",
  "decidedAt": null,
  "cancelledAt": "2026-10-14T06:00:00.000Z",
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z",
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "Ruang Kelas 101",
    "assetCode": "R-KLS-101",
    "facilityGroup": {
      "id": "33333333-3333-4333-8333-333333333333",
      "name": "Ruang Kelas 101",
      "locationDetail": "Gedung A, Lantai 1",
      "facilityArea": {
        "id": "55555555-5555-4555-8555-555555555555",
        "code": "TEMBALANG",
        "name": "Kampus Tembalang"
      },
      "facilityType": {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Ruang Kelas"
      }
    }
  },
  "facilityGroup": null,
  "items": [],
  "allocatedAssets": [],
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "email": "user1@unispace.local",
    "identityNumber": "24060001"
  },
  "processedBy": {
    "id": "99999999-9999-4999-8999-999999999999",
    "name": "Aulia Pratama",
    "email": "staff1@unispace.local"
  }
}
```

Kirim field reason, dipangkas dan panjang 5 sampai 1000 karakter. Pengajuan harus berada pada status yang dapat dibatalkan petugas.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>POST /api/v1/staff/reservations/auto-reject-expired</strong></summary>

Menjalankan pemeriksaan manual SLA dan menolak PENDING kedaluwarsa.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | Tidak ada body |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reservations/staff-reservations.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/staff/reservations/auto-reject-expired" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "success": true,
  "processedCount": 1,
  "message": "Berhasil mengevaluasi dan menolak otomatis 1 permohonan reservasi yang melewati batas SLA."
}
```

| Status gagal utama | Kondisi |
|---|---|
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>


### Laporan pengguna


| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/api/v1/reports` | USER | Mengirim laporan unit fasilitas dengan bukti foto. |
| GET | `/api/v1/reports/reportable-facilities` | USER | Daftar unit fisik yang dapat dipilih untuk laporan. |
| GET | `/api/v1/reports/:reportId/attachments/:attachmentId` | USER, STAFF | Mengalirkan foto laporan sesuai hak akses pelapor/petugas. |
| GET | `/api/v1/reports/me` | USER | Daftar laporan milik pengguna yang login. |
| GET | `/api/v1/reports/me/:reportId` | USER | Detail laporan milik pengguna yang login. |

<details>
<summary><strong>POST /api/v1/reports</strong></summary>

Mengirim laporan unit fasilitas dengan bukti foto.

| Properti | Nilai |
|---|---|
| Akses | USER |
| Request | multipart/form-data |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| Idempotency-Key | header | string | Tidak | 8 sampai 255 karakter, scope aktor, TTL 24 jam | - |
| facilityId | form-data | string (UUID v4) | Ya | Sesuai tipe; field lain di luar kontrak ditolak | - |
| category | form-data | ReportCategory | Ya | Pilihan: `PHYSICAL_DAMAGE`, `ELECTRICAL_ELECTRONICS`, `CLEANLINESS`, `FURNITURE_EQUIPMENT`, `SECURITY`, `OTHER` | - |
| description | form-data | string | Ya | Panjang maksimum 5000; Tidak kosong | - |
| photos | form-data | file[] | Ya | 1 sampai 3 JPEG/PNG/WebP; maksimum 5 MB per file | - |

**Field teks multipart (representasi JSON, kirim sebagai form-data)**

```json
{
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "category": "ELECTRICAL_ELECTRONICS",
  "description": "Proyektor di ruang tidak menyala."
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/reports" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Idempotency-Key: demo-f281bb7fa6d7270a" \
  -F 'facilityId=22222222-2222-4222-8222-222222222222' \
  -F 'category=ELECTRICAL_ELECTRONICS' \
  -F 'description=Proyektor di ruang tidak menyala.' \
  -F "photos=@kerusakan.jpg"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "77777777-7777-4777-8777-777777777777",
  "reportNumber": "RPT-20261014060000-ABC123",
  "reporter": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "identityNumber": "24060001",
    "email": "user1@unispace.local"
  },
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "assetCode": "R-KLS-101",
    "name": "Ruang Kelas 101",
    "status": "ACTIVE",
    "facilityGroupId": "33333333-3333-4333-8333-333333333333",
    "facilityGroupName": "Ruang Kelas 101",
    "reservationMode": "EXCLUSIVE"
  },
  "category": "ELECTRICAL_ELECTRONICS",
  "categoryLabel": "Listrik/Elektronik",
  "description": "Proyektor di ruang tidak menyala.",
  "status": "NEW",
  "statusLabel": "Baru",
  "decisionReason": null,
  "resolutionNote": null,
  "acceptedBy": null,
  "acceptedAt": null,
  "resolvedBy": null,
  "resolvedAt": null,
  "processedBy": null,
  "attachments": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "storageProvider": "MINIO",
      "originalFilename": "kerusakan.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 120000,
      "createdAt": "2026-10-14T06:00:00.000Z",
      "downloadUrl": "/reports/77777777-7777-4777-8777-777777777777/attachments/99999999-9999-4999-8999-999999999999"
    }
  ],
  "maintenancePeriods": [],
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

Gunakan multipart/form-data dengan field photos berulang, 1 sampai 3 JPEG/PNG/WebP, maksimum 5 MB per foto. Laporan harus menargetkan unit fisik, termasuk alat QUANTITY, bukan ID kelompok.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 409 | IDEMPOTENCY_KEY_REUSED / IDEMPOTENCY_REQUEST_IN_PROGRESS. |
| 413 | Foto lebih besar dari 5 MB. |
| 503 | Object storage tidak tersedia bila error storage dipetakan oleh service. |

</details>

<details>
<summary><strong>GET /api/v1/reports/reportable-facilities</strong></summary>

Daftar unit fisik yang dapat dipilih untuk laporan.

| Properti | Nilai |
|---|---|
| Akses | USER |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| search | query | string | Tidak | Panjang maksimum 150 | - |
| facilityGroupId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityAreaId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 50 | 20 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/reports/reportable-facilities?search=kelas&facilityGroupId=33333333-3333-4333-8333-333333333333&facilityAreaId=55555555-5555-4555-8555-555555555555&page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "items": [
    {
      "facilityId": "22222222-2222-4222-8222-222222222222",
      "assetCode": "R-KLS-101",
      "name": "Ruang Kelas 101",
      "facilityGroup": {
        "id": "33333333-3333-4333-8333-333333333333",
        "name": "Ruang Kelas 101",
        "reservationMode": "EXCLUSIVE"
      },
      "facilityType": {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Ruang Kelas"
      },
      "facilityArea": {
        "id": "55555555-5555-4555-8555-555555555555",
        "code": "TEMBALANG",
        "name": "Kampus Tembalang"
      },
      "locationDetail": "Gedung A, Lantai 1",
      "status": "ACTIVE"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

Pencarian mencocokkan nama/kode aset. Unit NONACTIVE disembunyikan; unit dalam perbaikan tetap dapat dipilih dan ditandai MAINTENANCE.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/reports/:reportId/attachments/:attachmentId</strong></summary>

Mengalirkan foto laporan sesuai hak akses pelapor/petugas.

| Properti | Nilai |
|---|---|
| Akses | USER, STAFF |
| Request | Tidak ada body |
| Sukses | 200; file binary |
| Acuan | [Controller](unispace-backend/src/reports/reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| reportId | path | string (UUID) | Ya | ID sesuai entitas | - |
| attachmentId | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -sS -X GET "http://localhost:3001/api/v1/reports/77777777-7777-4777-8777-777777777777/attachments/99999999-9999-4999-8999-999999999999" \
  -H "Authorization: Bearer <accessToken>" \
  --output foto.jpg
```

**Respons file**

Content-Type mengikuti JPEG/PNG/WebP. Content-Disposition: `inline; filename*=UTF-8''<nama-file-encoded>`. Cache-Control: `private, no-store`; X-Content-Type-Options: `nosniff`. Tidak ada envelope JSON.

USER hanya dapat mengakses attachment laporannya sendiri; STAFF dapat mengakses laporan dalam antrean. ADMIN tidak diberi akses download foto oleh controller ini.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 503 | OBJECT_STORAGE_UNAVAILABLE. |

</details>

<details>
<summary><strong>GET /api/v1/reports/me</strong></summary>

Daftar laporan milik pengguna yang login.

| Properti | Nilai |
|---|---|
| Akses | USER |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| status | query | ReportStatus | Tidak | Pilihan: `NEW`, `IN_PROGRESS`, `RESOLVED`, `REJECTED` | - |
| facilityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| createdFrom | query | string | Tidak | Tanggal ISO 8601 | - |
| createdTo | query | string | Tidak | Tanggal ISO 8601 | - |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 100 | 20 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/reports/me?status=NEW&facilityId=22222222-2222-4222-8222-222222222222&createdFrom=2026-10-01&createdTo=2026-10-14&page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "items": [
    {
      "id": "77777777-7777-4777-8777-777777777777",
      "reportNumber": "RPT-20261014060000-ABC123",
      "reporter": {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Pengguna Demo 01",
        "identityNumber": "24060001",
        "email": "user1@unispace.local"
      },
      "facility": {
        "id": "22222222-2222-4222-8222-222222222222",
        "assetCode": "R-KLS-101",
        "name": "Ruang Kelas 101",
        "status": "ACTIVE",
        "facilityGroupId": "33333333-3333-4333-8333-333333333333",
        "facilityGroupName": "Ruang Kelas 101",
        "reservationMode": "EXCLUSIVE"
      },
      "category": "ELECTRICAL_ELECTRONICS",
      "categoryLabel": "Listrik/Elektronik",
      "description": "Proyektor di ruang tidak menyala.",
      "status": "NEW",
      "statusLabel": "Baru",
      "decisionReason": null,
      "resolutionNote": null,
      "acceptedBy": null,
      "acceptedAt": null,
      "resolvedBy": null,
      "resolvedAt": null,
      "processedBy": null,
      "attachments": [
        {
          "id": "99999999-9999-4999-8999-999999999999",
          "storageProvider": "MINIO",
          "originalFilename": "kerusakan.jpg",
          "mimeType": "image/jpeg",
          "sizeBytes": 120000,
          "createdAt": "2026-10-14T06:00:00.000Z",
          "downloadUrl": "/reports/77777777-7777-4777-8777-777777777777/attachments/99999999-9999-4999-8999-999999999999"
        }
      ],
      "maintenancePeriods": [],
      "createdAt": "2026-10-14T06:00:00.000Z",
      "updatedAt": "2026-10-14T06:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/reports/me/:reportId</strong></summary>

Detail laporan milik pengguna yang login.

| Properti | Nilai |
|---|---|
| Akses | USER |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| reportId | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/reports/me/77777777-7777-4777-8777-777777777777" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "77777777-7777-4777-8777-777777777777",
  "reportNumber": "RPT-20261014060000-ABC123",
  "reporter": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "identityNumber": "24060001",
    "email": "user1@unispace.local"
  },
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "assetCode": "R-KLS-101",
    "name": "Ruang Kelas 101",
    "status": "ACTIVE",
    "facilityGroupId": "33333333-3333-4333-8333-333333333333",
    "facilityGroupName": "Ruang Kelas 101",
    "reservationMode": "EXCLUSIVE"
  },
  "category": "ELECTRICAL_ELECTRONICS",
  "categoryLabel": "Listrik/Elektronik",
  "description": "Proyektor di ruang tidak menyala.",
  "status": "NEW",
  "statusLabel": "Baru",
  "decisionReason": null,
  "resolutionNote": null,
  "acceptedBy": null,
  "acceptedAt": null,
  "resolvedBy": null,
  "resolvedAt": null,
  "processedBy": null,
  "attachments": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "storageProvider": "MINIO",
      "originalFilename": "kerusakan.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 120000,
      "createdAt": "2026-10-14T06:00:00.000Z",
      "downloadUrl": "/reports/77777777-7777-4777-8777-777777777777/attachments/99999999-9999-4999-8999-999999999999"
    }
  ],
  "maintenancePeriods": [],
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>


### Laporan dan perbaikan petugas


| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/v1/staff/facilities/maintenance` | STAFF | Daftar perbaikan aktif/terjadwal pada fasilitas yang tidak nonaktif. |
| POST | `/api/v1/staff/facilities/:facilityId/maintenance/preview` | STAFF | Preview dampak perbaikan mandiri pada unit fisik. |
| POST | `/api/v1/staff/facilities/:facilityId/maintenance` | STAFF | Membuat perbaikan mandiri tanpa laporan, beserta dampak reservasi. |
| GET | `/api/v1/staff/dashboard/summary` | STAFF | Jumlah antrean reservasi dan laporan untuk dashboard/badge petugas. |
| GET | `/api/v1/staff/reports` | STAFF | Daftar antrean laporan bersama petugas. |
| POST | `/api/v1/staff/reports/:reportId/maintenance/preview` | STAFF | Preview perbaikan dari laporan IN_PROGRESS tanpa menyimpan periode. |
| POST | `/api/v1/staff/reports/:reportId/maintenance` | STAFF | Membuat periode perbaikan dari laporan dan menerapkan dampak reservasi. |
| PATCH | `/api/v1/staff/reports/maintenance/:periodId/end` | STAFF | Mengakhiri periode perbaikan aktif/terjadwal lebih awal. |
| GET | `/api/v1/staff/reports/:reportId` | STAFF | Detail laporan untuk petugas. |
| GET | `/api/v1/staff/reports/:reportId/audit` | STAFF, ADMIN | Audit laporan, perbaikan, dan fasilitas terkait untuk STAFF/ADMIN. |
| PATCH | `/api/v1/staff/reports/:reportId/accept` | STAFF | Menerima NEW menjadi IN_PROGRESS dan mencatat penerima pertama. |
| PATCH | `/api/v1/staff/reports/:reportId/reject` | STAFF | Menolak laporan NEW dengan alasan. |
| PATCH | `/api/v1/staff/reports/:reportId/resolve` | STAFF | Menyelesaikan IN_PROGRESS dengan catatan resolusi. |

<details>
<summary><strong>GET /api/v1/staff/facilities/maintenance</strong></summary>

Daftar perbaikan aktif/terjadwal pada fasilitas yang tidak nonaktif.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/staff-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| state | query | 'ALL' \| 'ACTIVE' \| 'SCHEDULED' | Tidak | Pilihan: `ALL`, `ACTIVE`, `SCHEDULED` | ALL |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 50 | 20 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/staff/facilities/maintenance?state=ALL&page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "items": [
    {
      "id": "88888888-8888-4888-8888-888888888888",
      "note": "Perbaikan perangkat ruang.",
      "startAt": "2026-10-19T02:00:00.000Z",
      "endAt": "2026-10-19T03:00:00.000Z",
      "facility": {
        "id": "22222222-2222-4222-8222-222222222222",
        "assetCode": "R-KLS-101",
        "name": "Ruang Kelas 101",
        "facilityGroup": {
          "id": "33333333-3333-4333-8333-333333333333",
          "name": "Ruang Kelas 101",
          "reservationMode": "EXCLUSIVE",
          "facilityArea": {
            "id": "55555555-5555-4555-8555-555555555555",
            "name": "Kampus Tembalang"
          }
        }
      },
      "report": {
        "id": "77777777-7777-4777-8777-777777777777",
        "reportNumber": "RPT-20261014060000-ABC123",
        "status": "IN_PROGRESS",
        "category": "ELECTRICAL_ELECTRONICS",
        "categoryLabel": "Listrik/Elektronik"
      },
      "state": "SCHEDULED"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

state=ALL hanya mencakup aktif/terjadwal, bukan histori yang sudah selesai. Respons tidak memiliki reportId/facilityId di level item; report/facility dikembalikan sebagai objek.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 409 | Konflik periode/status atau konfirmasi dampak belum valid. |

</details>

<details>
<summary><strong>POST /api/v1/staff/facilities/:facilityId/maintenance/preview</strong></summary>

Preview dampak perbaikan mandiri pada unit fisik.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/staff-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| facilityId | path | string (UUID) | Ya | ID sesuai entitas | - |
| mode | body | MaintenanceMode | Ya | DATE_RANGE atau TIME_RANGE; kedua mode tidak boleh dicampur | - |
| startDate | body | string | Untuk DATE_RANGE | YYYY-MM-DD; hanya DATE_RANGE, endDate >= startDate | - |
| endDate | body | string | Untuk DATE_RANGE | YYYY-MM-DD; hanya DATE_RANGE, endDate >= startDate | - |
| date | body | string | Untuk TIME_RANGE | YYYY-MM-DD; hanya TIME_RANGE | - |
| startTime | body | string | Untuk TIME_RANGE | HH:mm pada batas slot 30 menit, 07:00 sampai 20:00; endTime > startTime; hanya TIME_RANGE | - |
| endTime | body | string | Untuk TIME_RANGE | HH:mm pada batas slot 30 menit, 07:00 sampai 20:00; endTime > startTime; hanya TIME_RANGE | - |

**Contoh body JSON**

```json
{
  "mode": "TIME_RANGE",
  "date": "2026-10-19",
  "startTime": "09:00",
  "endTime": "10:00"
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/staff/facilities/22222222-2222-4222-8222-222222222222/maintenance/preview" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"mode":"TIME_RANGE","date":"2026-10-19","startTime":"09:00","endTime":"10:00"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "approvedReservations": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "usageDate": "2026-10-19T00:00:00.000Z",
      "startTime": "1970-01-01T09:00:00.000Z",
      "endTime": "1970-01-01T10:00:00.000Z"
    }
  ],
  "pendingReservations": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "usageDate": "2026-10-19T00:00:00.000Z",
      "startTime": "1970-01-01T09:00:00.000Z",
      "endTime": "1970-01-01T10:00:00.000Z",
      "requestedQuantity": 1
    }
  ]
}
```

**Alternatif body mode DATE_RANGE**

```json
{
  "mode": "DATE_RANGE",
  "startDate": "2026-10-19",
  "endDate": "2026-10-20"
}
```

TIME_RANGE memakai satu date dan startTime/endTime. DATE_RANGE menutup jam 07:00 sampai 20:00 pada rentang startDate/endDate. Preview tidak mengubah data. Saat confirm/create, kirim cancelImpactedReservations=true dan alasan pembatalan tidak kosong, termasuk bila tidak ada APPROVED terdampak. Periode dan dampaknya diperiksa lagi dalam transaksi.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Konflik periode/status atau konfirmasi dampak belum valid. |

</details>

<details>
<summary><strong>POST /api/v1/staff/facilities/:facilityId/maintenance</strong></summary>

Membuat perbaikan mandiri tanpa laporan, beserta dampak reservasi.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/facilities/staff-facilities.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| facilityId | path | string (UUID) | Ya | ID sesuai entitas | - |
| Idempotency-Key | header | string | Tidak | 8 sampai 255 karakter, scope aktor, TTL 24 jam | - |
| mode | body | MaintenanceMode | Ya | DATE_RANGE atau TIME_RANGE; kedua mode tidak boleh dicampur | - |
| startDate | body | string | Untuk DATE_RANGE | YYYY-MM-DD; hanya DATE_RANGE, endDate >= startDate | - |
| endDate | body | string | Untuk DATE_RANGE | YYYY-MM-DD; hanya DATE_RANGE, endDate >= startDate | - |
| date | body | string | Untuk TIME_RANGE | YYYY-MM-DD; hanya TIME_RANGE | - |
| startTime | body | string | Untuk TIME_RANGE | HH:mm pada batas slot 30 menit, 07:00 sampai 20:00; endTime > startTime; hanya TIME_RANGE | - |
| endTime | body | string | Untuk TIME_RANGE | HH:mm pada batas slot 30 menit, 07:00 sampai 20:00; endTime > startTime; hanya TIME_RANGE | - |
| note | body | string | Ya | Panjang maksimum 500; Tidak kosong | - |
| cancellationReason | body | string | Ya | Panjang maksimum 500; Tidak kosong; Tidak kosong; wajib pada service saat confirm/create | - |
| cancelImpactedReservations | body | boolean | Ya | Boolean wajib bernilai true saat confirm/create, walaupun preview tidak menemukan APPROVED | - |

**Contoh body JSON**

```json
{
  "mode": "TIME_RANGE",
  "date": "2026-10-19",
  "startTime": "09:00",
  "endTime": "10:00",
  "note": "Perbaikan perangkat ruang.",
  "cancellationReason": "Fasilitas memerlukan perbaikan.",
  "cancelImpactedReservations": true
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/staff/facilities/22222222-2222-4222-8222-222222222222/maintenance" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Idempotency-Key: demo-8ddd9f1722ada0ab" \
  -H "Content-Type: application/json" \
  --data '{"mode":"TIME_RANGE","date":"2026-10-19","startTime":"09:00","endTime":"10:00","note":"Perbaikan perangkat ruang.","cancellationReason":"Fasilitas memerlukan perbaikan.","cancelImpactedReservations":true}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "88888888-8888-4888-8888-888888888888",
  "reportId": null,
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "startAt": "2026-10-19T02:00:00.000Z",
  "endAt": "2026-10-19T03:00:00.000Z",
  "note": "Perbaikan perangkat ruang.",
  "approvedCancelled": 1,
  "pendingRejected": 1
}
```

**Alternatif body mode DATE_RANGE**

```json
{
  "mode": "DATE_RANGE",
  "startDate": "2026-10-19",
  "endDate": "2026-10-20",
  "cancelImpactedReservations": true,
  "cancellationReason": "Fasilitas memerlukan perbaikan.",
  "note": "Perbaikan perangkat ruang."
}
```

TIME_RANGE memakai satu date dan startTime/endTime. DATE_RANGE menutup jam 07:00 sampai 20:00 pada rentang startDate/endDate. Preview tidak mengubah data. Saat confirm/create, kirim cancelImpactedReservations=true dan alasan pembatalan tidak kosong, termasuk bila tidak ada APPROVED terdampak. Periode dan dampaknya diperiksa lagi dalam transaksi.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Konflik periode/status atau konfirmasi dampak belum valid. |
| 409 | IDEMPOTENCY_KEY_REUSED / IDEMPOTENCY_REQUEST_IN_PROGRESS. |

</details>

<details>
<summary><strong>GET /api/v1/staff/dashboard/summary</strong></summary>

Jumlah antrean reservasi dan laporan untuk dashboard/badge petugas.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/staff-dashboard.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/staff/dashboard/summary" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "reservations": {
    "pending": 2,
    "overdueDecision": 1
  },
  "reports": {
    "new": 1,
    "inProgress": 2
  },
  "generatedAt": "2026-10-14T06:00:00.000Z"
}
```

overdueDecision menghitung PENDING yang melewati SLA; new dan inProgress menghitung laporan pada status terkait.

| Status gagal utama | Kondisi |
|---|---|
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/staff/reports</strong></summary>

Daftar antrean laporan bersama petugas.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/staff-reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| search | query | string | Tidak | Panjang maksimum 150 | - |
| createdFrom | query | string | Tidak | Tanggal ISO 8601 | - |
| createdTo | query | string | Tidak | Tanggal ISO 8601 | - |
| status | query | ReportStatus | Tidak | Pilihan: `NEW`, `IN_PROGRESS`, `RESOLVED`, `REJECTED` | - |
| facilityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 100 | 20 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/staff/reports?search=kelas&createdFrom=2026-10-01&createdTo=2026-10-14&status=NEW&facilityId=22222222-2222-4222-8222-222222222222&page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "items": [
    {
      "id": "77777777-7777-4777-8777-777777777777",
      "reportNumber": "RPT-20261014060000-ABC123",
      "reporter": {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Pengguna Demo 01",
        "identityNumber": "24060001",
        "email": "user1@unispace.local"
      },
      "facility": {
        "id": "22222222-2222-4222-8222-222222222222",
        "assetCode": "R-KLS-101",
        "name": "Ruang Kelas 101",
        "status": "ACTIVE",
        "facilityGroupId": "33333333-3333-4333-8333-333333333333",
        "facilityGroupName": "Ruang Kelas 101",
        "reservationMode": "EXCLUSIVE"
      },
      "category": "ELECTRICAL_ELECTRONICS",
      "categoryLabel": "Listrik/Elektronik",
      "description": "Proyektor di ruang tidak menyala.",
      "status": "NEW",
      "statusLabel": "Baru",
      "decisionReason": null,
      "resolutionNote": null,
      "acceptedBy": null,
      "acceptedAt": null,
      "resolvedBy": null,
      "resolvedAt": null,
      "processedBy": null,
      "attachments": [
        {
          "id": "99999999-9999-4999-8999-999999999999",
          "storageProvider": "MINIO",
          "originalFilename": "kerusakan.jpg",
          "mimeType": "image/jpeg",
          "sizeBytes": 120000,
          "createdAt": "2026-10-14T06:00:00.000Z",
          "downloadUrl": "/reports/77777777-7777-4777-8777-777777777777/attachments/99999999-9999-4999-8999-999999999999"
        }
      ],
      "maintenancePeriods": [],
      "createdAt": "2026-10-14T06:00:00.000Z",
      "updatedAt": "2026-10-14T06:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>POST /api/v1/staff/reports/:reportId/maintenance/preview</strong></summary>

Preview perbaikan dari laporan IN_PROGRESS tanpa menyimpan periode.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/staff-reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| reportId | path | string (UUID) | Ya | ID sesuai entitas | - |
| mode | body | MaintenanceMode | Ya | DATE_RANGE atau TIME_RANGE; kedua mode tidak boleh dicampur | - |
| startDate | body | string | Untuk DATE_RANGE | YYYY-MM-DD; hanya DATE_RANGE, endDate >= startDate | - |
| endDate | body | string | Untuk DATE_RANGE | YYYY-MM-DD; hanya DATE_RANGE, endDate >= startDate | - |
| date | body | string | Untuk TIME_RANGE | YYYY-MM-DD; hanya TIME_RANGE | - |
| startTime | body | string | Untuk TIME_RANGE | HH:mm pada batas slot 30 menit, 07:00 sampai 20:00; endTime > startTime; hanya TIME_RANGE | - |
| endTime | body | string | Untuk TIME_RANGE | HH:mm pada batas slot 30 menit, 07:00 sampai 20:00; endTime > startTime; hanya TIME_RANGE | - |

**Contoh body JSON**

```json
{
  "mode": "TIME_RANGE",
  "date": "2026-10-19",
  "startTime": "09:00",
  "endTime": "10:00"
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/staff/reports/77777777-7777-4777-8777-777777777777/maintenance/preview" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"mode":"TIME_RANGE","date":"2026-10-19","startTime":"09:00","endTime":"10:00"}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "reportId": "77777777-7777-4777-8777-777777777777",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "approvedReservations": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "usageDate": "2026-10-19T00:00:00.000Z",
      "startTime": "1970-01-01T09:00:00.000Z",
      "endTime": "1970-01-01T10:00:00.000Z"
    }
  ],
  "pendingReservations": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "usageDate": "2026-10-19T00:00:00.000Z",
      "startTime": "1970-01-01T09:00:00.000Z",
      "endTime": "1970-01-01T10:00:00.000Z",
      "requestedQuantity": 1
    }
  ]
}
```

**Alternatif body mode DATE_RANGE**

```json
{
  "mode": "DATE_RANGE",
  "startDate": "2026-10-19",
  "endDate": "2026-10-20"
}
```

TIME_RANGE memakai satu date dan startTime/endTime. DATE_RANGE menutup jam 07:00 sampai 20:00 pada rentang startDate/endDate. Preview tidak mengubah data. Saat confirm/create, kirim cancelImpactedReservations=true dan alasan pembatalan tidak kosong, termasuk bila tidak ada APPROVED terdampak. Periode dan dampaknya diperiksa lagi dalam transaksi.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Konflik periode/status atau konfirmasi dampak belum valid. |

</details>

<details>
<summary><strong>POST /api/v1/staff/reports/:reportId/maintenance</strong></summary>

Membuat periode perbaikan dari laporan dan menerapkan dampak reservasi.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | application/json |
| Sukses | 201; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/staff-reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| reportId | path | string (UUID) | Ya | ID sesuai entitas | - |
| Idempotency-Key | header | string | Tidak | 8 sampai 255 karakter, scope aktor, TTL 24 jam | - |
| mode | body | MaintenanceMode | Ya | DATE_RANGE atau TIME_RANGE; kedua mode tidak boleh dicampur | - |
| startDate | body | string | Untuk DATE_RANGE | YYYY-MM-DD; hanya DATE_RANGE, endDate >= startDate | - |
| endDate | body | string | Untuk DATE_RANGE | YYYY-MM-DD; hanya DATE_RANGE, endDate >= startDate | - |
| date | body | string | Untuk TIME_RANGE | YYYY-MM-DD; hanya TIME_RANGE | - |
| startTime | body | string | Untuk TIME_RANGE | HH:mm pada batas slot 30 menit, 07:00 sampai 20:00; endTime > startTime; hanya TIME_RANGE | - |
| endTime | body | string | Untuk TIME_RANGE | HH:mm pada batas slot 30 menit, 07:00 sampai 20:00; endTime > startTime; hanya TIME_RANGE | - |
| cancelImpactedReservations | body | boolean | Ya | Boolean wajib bernilai true saat confirm/create, walaupun preview tidak menemukan APPROVED | - |
| cancellationReason | body | string | Ya (service) | Panjang maksimum 1000; Tidak kosong; wajib pada service saat confirm/create | - |
| note | body | string | Tidak | Panjang maksimum 5000 | - |

**Contoh body JSON**

```json
{
  "mode": "TIME_RANGE",
  "date": "2026-10-19",
  "startTime": "09:00",
  "endTime": "10:00",
  "cancelImpactedReservations": true,
  "cancellationReason": "Fasilitas memerlukan perbaikan.",
  "note": "Perbaikan perangkat ruang."
}
```

**Contoh request**

```bash
curl -i -X POST "http://localhost:3001/api/v1/staff/reports/77777777-7777-4777-8777-777777777777/maintenance" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Idempotency-Key: demo-a0d90776f2921a92" \
  -H "Content-Type: application/json" \
  --data '{"mode":"TIME_RANGE","date":"2026-10-19","startTime":"09:00","endTime":"10:00","cancelImpactedReservations":true,"cancellationReason":"Fasilitas memerlukan perbaikan.","note":"Perbaikan perangkat ruang."}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "88888888-8888-4888-8888-888888888888",
  "reportId": "77777777-7777-4777-8777-777777777777",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "startAt": "2026-10-19T02:00:00.000Z",
  "endAt": "2026-10-19T03:00:00.000Z",
  "note": "Perbaikan perangkat ruang.",
  "approvedCancelled": 1,
  "pendingRejected": 1
}
```

**Alternatif body mode DATE_RANGE**

```json
{
  "mode": "DATE_RANGE",
  "startDate": "2026-10-19",
  "endDate": "2026-10-20",
  "cancelImpactedReservations": true,
  "cancellationReason": "Fasilitas memerlukan perbaikan.",
  "note": "Perbaikan perangkat ruang."
}
```

TIME_RANGE memakai satu date dan startTime/endTime. DATE_RANGE menutup jam 07:00 sampai 20:00 pada rentang startDate/endDate. Preview tidak mengubah data. Saat confirm/create, kirim cancelImpactedReservations=true dan alasan pembatalan tidak kosong, termasuk bila tidak ada APPROVED terdampak. Periode dan dampaknya diperiksa lagi dalam transaksi.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Konflik periode/status atau konfirmasi dampak belum valid. |
| 409 | IDEMPOTENCY_KEY_REUSED / IDEMPOTENCY_REQUEST_IN_PROGRESS. |

</details>

<details>
<summary><strong>PATCH /api/v1/staff/reports/maintenance/:periodId/end</strong></summary>

Mengakhiri periode perbaikan aktif/terjadwal lebih awal.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/staff-reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| periodId | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/staff/reports/maintenance/88888888-8888-4888-8888-888888888888/end" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "88888888-8888-4888-8888-888888888888",
  "reportId": "77777777-7777-4777-8777-777777777777",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "startAt": "2026-10-19T02:00:00.000Z",
  "endAt": "2026-10-14T06:00:00.000Z",
  "note": "Perbaikan perangkat ruang."
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | Konflik periode/status atau konfirmasi dampak belum valid. |

</details>

<details>
<summary><strong>GET /api/v1/staff/reports/:reportId</strong></summary>

Detail laporan untuk petugas.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/staff-reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| reportId | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/staff/reports/77777777-7777-4777-8777-777777777777" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "77777777-7777-4777-8777-777777777777",
  "reportNumber": "RPT-20261014060000-ABC123",
  "reporter": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "identityNumber": "24060001",
    "email": "user1@unispace.local"
  },
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "assetCode": "R-KLS-101",
    "name": "Ruang Kelas 101",
    "status": "ACTIVE",
    "facilityGroupId": "33333333-3333-4333-8333-333333333333",
    "facilityGroupName": "Ruang Kelas 101",
    "reservationMode": "EXCLUSIVE"
  },
  "category": "ELECTRICAL_ELECTRONICS",
  "categoryLabel": "Listrik/Elektronik",
  "description": "Proyektor di ruang tidak menyala.",
  "status": "NEW",
  "statusLabel": "Baru",
  "decisionReason": null,
  "resolutionNote": null,
  "acceptedBy": null,
  "acceptedAt": null,
  "resolvedBy": null,
  "resolvedAt": null,
  "processedBy": null,
  "attachments": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "storageProvider": "MINIO",
      "originalFilename": "kerusakan.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 120000,
      "createdAt": "2026-10-14T06:00:00.000Z",
      "downloadUrl": "/reports/77777777-7777-4777-8777-777777777777/attachments/99999999-9999-4999-8999-999999999999"
    }
  ],
  "maintenancePeriods": [],
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>GET /api/v1/staff/reports/:reportId/audit</strong></summary>

Audit laporan, perbaikan, dan fasilitas terkait untuk STAFF/ADMIN.

| Properti | Nilai |
|---|---|
| Akses | STAFF, ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/staff-reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| reportId | path | string (UUID) | Ya | ID sesuai entitas | - |
| action | query | string | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| actorId | query | string | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| from | query | string | Tidak | Tanggal ISO 8601 | - |
| to | query | string | Tidak | Tanggal ISO 8601 | - |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 100 | 50 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/staff/reports/77777777-7777-4777-8777-777777777777/audit?action=REPORT_CREATED&actorId=11111111-1111-4111-8111-111111111111&from=2026-10-01&to=2026-10-14&page=1&limit=50" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "items": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "action": "REPORT_CREATED",
      "entityType": "FACILITY_REPORT",
      "entityId": "77777777-7777-4777-8777-777777777777",
      "metadata": {
        "category": "ELECTRICAL_ELECTRONICS"
      },
      "createdAt": "2026-10-14T06:00:00.000Z",
      "actor": {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Pengguna Demo 01",
        "role": "USER"
      }
    }
  ],
  "page": 1,
  "limit": 50,
  "total": 1,
  "totalPages": 1
}
```

Role STAFF atau ADMIN berlaku khusus pada endpoint audit ini. actorId pada DTO audit laporan berupa string, berbeda dari audit global yang memakai UUID v4.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |

</details>

<details>
<summary><strong>PATCH /api/v1/staff/reports/:reportId/accept</strong></summary>

Menerima NEW menjadi IN_PROGRESS dan mencatat penerima pertama.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/staff-reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| reportId | path | string (UUID) | Ya | ID sesuai entitas | - |

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/staff/reports/77777777-7777-4777-8777-777777777777/accept" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "77777777-7777-4777-8777-777777777777",
  "reportNumber": "RPT-20261014060000-ABC123",
  "reporter": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "identityNumber": "24060001",
    "email": "user1@unispace.local"
  },
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "assetCode": "R-KLS-101",
    "name": "Ruang Kelas 101",
    "status": "ACTIVE",
    "facilityGroupId": "33333333-3333-4333-8333-333333333333",
    "facilityGroupName": "Ruang Kelas 101",
    "reservationMode": "EXCLUSIVE"
  },
  "category": "ELECTRICAL_ELECTRONICS",
  "categoryLabel": "Listrik/Elektronik",
  "description": "Proyektor di ruang tidak menyala.",
  "status": "IN_PROGRESS",
  "statusLabel": "Diproses",
  "decisionReason": null,
  "resolutionNote": null,
  "acceptedBy": {
    "id": "99999999-9999-4999-8999-999999999999",
    "name": "Aulia Pratama",
    "identityNumber": "19870001",
    "email": "staff1@unispace.local"
  },
  "acceptedAt": "2026-10-14T06:00:00.000Z",
  "resolvedBy": null,
  "resolvedAt": null,
  "processedBy": {
    "id": "99999999-9999-4999-8999-999999999999",
    "name": "Aulia Pratama",
    "identityNumber": "19870001",
    "email": "staff1@unispace.local"
  },
  "attachments": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "storageProvider": "MINIO",
      "originalFilename": "kerusakan.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 120000,
      "createdAt": "2026-10-14T06:00:00.000Z",
      "downloadUrl": "/reports/77777777-7777-4777-8777-777777777777/attachments/99999999-9999-4999-8999-999999999999"
    }
  ],
  "maintenancePeriods": [],
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

Laporan IN_PROGRESS adalah antrean bersama; petugas lain tetap boleh melanjutkan. Penerima pertama tidak diganti.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | REPORT_INVALID_TRANSITION; resolve juga dapat menghasilkan REPORT_MAINTENANCE_STILL_ACTIVE_OR_SCHEDULED. |

</details>

<details>
<summary><strong>PATCH /api/v1/staff/reports/:reportId/reject</strong></summary>

Menolak laporan NEW dengan alasan.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/staff-reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| reportId | path | string (UUID) | Ya | ID sesuai entitas | - |
| reason | body | string | Ya | Panjang maksimum 1000; Tidak kosong | - |

**Contoh body JSON**

```json
{
  "reason": "Laporan tidak sesuai kondisi fasilitas."
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/staff/reports/77777777-7777-4777-8777-777777777777/reject" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"reason":"Laporan tidak sesuai kondisi fasilitas."}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "77777777-7777-4777-8777-777777777777",
  "reportNumber": "RPT-20261014060000-ABC123",
  "reporter": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "identityNumber": "24060001",
    "email": "user1@unispace.local"
  },
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "assetCode": "R-KLS-101",
    "name": "Ruang Kelas 101",
    "status": "ACTIVE",
    "facilityGroupId": "33333333-3333-4333-8333-333333333333",
    "facilityGroupName": "Ruang Kelas 101",
    "reservationMode": "EXCLUSIVE"
  },
  "category": "ELECTRICAL_ELECTRONICS",
  "categoryLabel": "Listrik/Elektronik",
  "description": "Proyektor di ruang tidak menyala.",
  "status": "REJECTED",
  "statusLabel": "Ditolak",
  "decisionReason": "Laporan tidak sesuai kondisi fasilitas.",
  "resolutionNote": null,
  "acceptedBy": null,
  "acceptedAt": null,
  "resolvedBy": null,
  "resolvedAt": null,
  "processedBy": {
    "id": "99999999-9999-4999-8999-999999999999",
    "name": "Aulia Pratama",
    "identityNumber": "19870001",
    "email": "staff1@unispace.local"
  },
  "attachments": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "storageProvider": "MINIO",
      "originalFilename": "kerusakan.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 120000,
      "createdAt": "2026-10-14T06:00:00.000Z",
      "downloadUrl": "/reports/77777777-7777-4777-8777-777777777777/attachments/99999999-9999-4999-8999-999999999999"
    }
  ],
  "maintenancePeriods": [],
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

Penolakan hanya dari NEW; reason tidak boleh kosong dan maksimal 1000 karakter.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | REPORT_INVALID_TRANSITION; resolve juga dapat menghasilkan REPORT_MAINTENANCE_STILL_ACTIVE_OR_SCHEDULED. |

</details>

<details>
<summary><strong>PATCH /api/v1/staff/reports/:reportId/resolve</strong></summary>

Menyelesaikan IN_PROGRESS dengan catatan resolusi.

| Properti | Nilai |
|---|---|
| Akses | STAFF |
| Request | application/json |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/reports/staff-reports.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| reportId | path | string (UUID) | Ya | ID sesuai entitas | - |
| resolutionNote | body | string | Ya | Panjang maksimum 5000; Tidak kosong | - |

**Contoh body JSON**

```json
{
  "resolutionNote": "Perangkat sudah diperbaiki dan diuji."
}
```

**Contoh request**

```bash
curl -i -X PATCH "http://localhost:3001/api/v1/staff/reports/77777777-7777-4777-8777-777777777777/resolve" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  --data '{"resolutionNote":"Perangkat sudah diperbaiki dan diuji."}'
```

**Contoh isi `data` pada respons sukses**

```json
{
  "id": "77777777-7777-4777-8777-777777777777",
  "reportNumber": "RPT-20261014060000-ABC123",
  "reporter": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Pengguna Demo 01",
    "identityNumber": "24060001",
    "email": "user1@unispace.local"
  },
  "facility": {
    "id": "22222222-2222-4222-8222-222222222222",
    "assetCode": "R-KLS-101",
    "name": "Ruang Kelas 101",
    "status": "ACTIVE",
    "facilityGroupId": "33333333-3333-4333-8333-333333333333",
    "facilityGroupName": "Ruang Kelas 101",
    "reservationMode": "EXCLUSIVE"
  },
  "category": "ELECTRICAL_ELECTRONICS",
  "categoryLabel": "Listrik/Elektronik",
  "description": "Proyektor di ruang tidak menyala.",
  "status": "RESOLVED",
  "statusLabel": "Selesai",
  "decisionReason": null,
  "resolutionNote": "Perangkat sudah diperbaiki dan diuji.",
  "acceptedBy": {
    "id": "99999999-9999-4999-8999-999999999999",
    "name": "Aulia Pratama",
    "identityNumber": "19870001",
    "email": "staff1@unispace.local"
  },
  "acceptedAt": "2026-10-14T06:00:00.000Z",
  "resolvedBy": {
    "id": "99999999-9999-4999-8999-999999999999",
    "name": "Aulia Pratama",
    "identityNumber": "19870001",
    "email": "staff1@unispace.local"
  },
  "resolvedAt": "2026-10-14T06:00:00.000Z",
  "processedBy": {
    "id": "99999999-9999-4999-8999-999999999999",
    "name": "Aulia Pratama",
    "identityNumber": "19870001",
    "email": "staff1@unispace.local"
  },
  "attachments": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "storageProvider": "MINIO",
      "originalFilename": "kerusakan.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 120000,
      "createdAt": "2026-10-14T06:00:00.000Z",
      "downloadUrl": "/reports/77777777-7777-4777-8777-777777777777/attachments/99999999-9999-4999-8999-999999999999"
    }
  ],
  "maintenancePeriods": [],
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

Hanya IN_PROGRESS; resolutionNote tidak boleh kosong, maksimal 5000 karakter. Ditolak jika ada perbaikan terhubung yang aktif atau terjadwal.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |
| 404 | Target atau file tidak ditemukan; untuk data pengguna, kepemilikan juga diperiksa. |
| 409 | REPORT_INVALID_TRANSITION; resolve juga dapat menghasilkan REPORT_MAINTENANCE_STILL_ACTIVE_OR_SCHEDULED. |

</details>


### Rekap, ekspor, dan audit admin


| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/v1/admin/audit-logs` | ADMIN | Daftar audit global yang dapat difilter admin. |
| GET | `/api/v1/admin/analytics/summary` | ADMIN | Rekap jumlah reservasi, laporan, unit, serta statistik durasi. |
| GET | `/api/v1/admin/analytics/occupancy` | ADMIN | Rekap okupansi ruang eksklusif. |
| GET | `/api/v1/admin/analytics/equipment-utilization` | ADMIN | Rekap utilisasi kelompok alat dalam unit-slot. |
| GET | `/api/v1/admin/analytics/damage-frequency` | ADMIN | Frekuensi laporan kerusakan menurut kategori, status, fasilitas, tipe, dan area. |
| GET | `/api/v1/admin/analytics/trends` | ADMIN | Grafik metrik okupansi/utilisasi/frekuensi menurut hari atau bulan. |
| GET | `/api/v1/admin/analytics/facility-report-history` | ADMIN | Riwayat laporan fasilitas dalam periode rekap. |
| GET | `/api/v1/admin/analytics/export` | ADMIN | Mengunduh rekap yang mengikuti filter dalam CSV, XLSX, atau PDF. |

<details>
<summary><strong>GET /api/v1/admin/audit-logs</strong></summary>

Daftar audit global yang dapat difilter admin.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/analytics/admin-audit-logs.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| actorId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| action | query | string | Tidak | Panjang maksimum 100 | - |
| entityType | query | string | Tidak | Panjang maksimum 100 | - |
| entityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| from | query | string | Tidak | Tanggal ISO 8601 | - |
| to | query | string | Tidak | Tanggal ISO 8601 | - |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 100 | 20 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/audit-logs?actorId=11111111-1111-4111-8111-111111111111&action=REPORT_CREATED&entityType=FACILITY_REPORT&entityId=77777777-7777-4777-8777-777777777777&from=2026-10-01&to=2026-10-14&page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "items": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "action": "REPORT_CREATED",
      "entityType": "FACILITY_REPORT",
      "entityId": "77777777-7777-4777-8777-777777777777",
      "metadata": {
        "category": "ELECTRICAL_ELECTRONICS"
      },
      "createdAt": "2026-10-14T06:00:00.000Z",
      "actor": {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Pengguna Demo 01",
        "role": "USER"
      }
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/admin/analytics/summary</strong></summary>

Rekap jumlah reservasi, laporan, unit, serta statistik durasi.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/analytics/analytics.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| allTime | query | boolean | Tidak | Query true/false; jika true, tanggal tidak wajib. Dukungan sesuai catatan endpoint. | - |
| dateFrom | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| dateTo | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| facilityAreaId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityTypeId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityGroupId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| reservationMode | query | ReservationMode | Tidak | Pilihan: `EXCLUSIVE`, `QUANTITY` | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/analytics/summary?dateFrom=2026-10-01&dateTo=2026-10-14" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "filters": {
    "allTime": false,
    "dateFrom": "2026-10-01",
    "dateTo": "2026-10-14",
    "facilityAreaId": null,
    "facilityTypeId": null,
    "facilityGroupId": null,
    "facilityId": null,
    "reservationMode": null
  },
  "generatedAt": "2026-10-14T06:00:00.000Z",
  "reservations": {
    "total": 2,
    "approvedOrCompleted": 2,
    "totalUsedHours": 2,
    "byStatus": {
      "PENDING": 0,
      "APPROVED": 2,
      "REJECTED": 0,
      "CANCELLED_BY_USER": 0,
      "CANCELLED_BY_STAFF": 0,
      "CANCELLED_BY_SYSTEM": 0,
      "COMPLETED": 0
    },
    "decisionTimeHours": {
      "count": 2,
      "average": 2,
      "median": 2
    }
  },
  "reports": {
    "total": 1,
    "qualifyingDamageReports": 1,
    "byStatus": {
      "NEW": 1,
      "IN_PROGRESS": 0,
      "RESOLVED": 0,
      "REJECTED": 0
    },
    "resolutionTimeHours": {
      "count": 0,
      "average": null,
      "median": null
    }
  },
  "facilities": {
    "totalUnits": 1,
    "currentNonactiveUnits": 0,
    "historicalNonactiveUnits": 0
  }
}
```

GET rekap menerima allTime=true tanpa dateFrom/dateTo. Jika tidak, kedua tanggal wajib dan rentang maksimum 366 hari. Filter target harus konsisten.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/admin/analytics/occupancy</strong></summary>

Rekap okupansi ruang eksklusif.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/analytics/analytics.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| allTime | query | boolean | Tidak | Query true/false; jika true, tanggal tidak wajib. Dukungan sesuai catatan endpoint. | - |
| dateFrom | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| dateTo | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| facilityAreaId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityTypeId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityGroupId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| reservationMode | query | ReservationMode | Tidak | Pilihan: `EXCLUSIVE`, `QUANTITY` | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/analytics/occupancy?dateFrom=2026-10-01&dateTo=2026-10-14" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "filters": {
    "allTime": false,
    "dateFrom": "2026-10-01",
    "dateTo": "2026-10-14",
    "facilityAreaId": null,
    "facilityTypeId": null,
    "facilityGroupId": null,
    "facilityId": null,
    "reservationMode": null
  },
  "generatedAt": "2026-10-14T06:00:00.000Z",
  "bookedSlots": 4,
  "availableSlots": 260,
  "percentage": 1.54,
  "facilities": [
    {
      "facilityId": "22222222-2222-4222-8222-222222222222",
      "assetCode": "R-KLS-101",
      "name": "Ruang Kelas 101",
      "facilityGroupId": "33333333-3333-4333-8333-333333333333",
      "facilityGroupName": "Ruang Kelas 101",
      "facilityArea": {
        "id": "55555555-5555-4555-8555-555555555555",
        "code": "TEMBALANG",
        "name": "Kampus Tembalang"
      },
      "facilityType": {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Ruang Kelas"
      },
      "currentStatus": "ACTIVE",
      "historicalNonactive": false,
      "bookedSlots": 4,
      "availableSlots": 260,
      "percentage": 1.54
    }
  ]
}
```

Menghitung APPROVED/COMPLETED. Maintenance tetap masuk pembagi; slot saat NONACTIVE dikeluarkan. percentage dapat null bila pembagi nol.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/admin/analytics/equipment-utilization</strong></summary>

Rekap utilisasi kelompok alat dalam unit-slot.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/analytics/analytics.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| allTime | query | boolean | Tidak | Query true/false; jika true, tanggal tidak wajib. Dukungan sesuai catatan endpoint. | - |
| dateFrom | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| dateTo | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| facilityAreaId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityTypeId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityGroupId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| reservationMode | query | ReservationMode | Tidak | Pilihan: `EXCLUSIVE`, `QUANTITY` | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/analytics/equipment-utilization?dateFrom=2026-10-01&dateTo=2026-10-14" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "filters": {
    "allTime": false,
    "dateFrom": "2026-10-01",
    "dateTo": "2026-10-14",
    "facilityAreaId": null,
    "facilityTypeId": null,
    "facilityGroupId": null,
    "facilityId": null,
    "reservationMode": null
  },
  "generatedAt": "2026-10-14T06:00:00.000Z",
  "usedUnitSlots": 4,
  "availableUnitSlots": 780,
  "percentage": 0.51,
  "facilityGroups": [
    {
      "facilityGroupId": "33333333-3333-4333-8333-333333333333",
      "name": "Proyektor Epson EB-X06",
      "facilityArea": {
        "id": "55555555-5555-4555-8555-555555555555",
        "code": "TEMBALANG",
        "name": "Kampus Tembalang"
      },
      "facilityType": {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Peralatan"
      },
      "currentNonactiveUnits": 0,
      "totalUnits": 3,
      "historicalNonactive": false,
      "usedUnitSlots": 4,
      "availableUnitSlots": 780,
      "percentage": 0.51
    }
  ]
}
```

Menggunakan unit-slot APPROVED/COMPLETED. percentage dapat null bila pembagi nol. GET menerima allTime=true.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/admin/analytics/damage-frequency</strong></summary>

Frekuensi laporan kerusakan menurut kategori, status, fasilitas, tipe, dan area.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/analytics/analytics.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| allTime | query | boolean | Tidak | Query true/false; jika true, tanggal tidak wajib. Dukungan sesuai catatan endpoint. | - |
| dateFrom | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| dateTo | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| facilityAreaId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityTypeId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityGroupId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| reservationMode | query | ReservationMode | Tidak | Pilihan: `EXCLUSIVE`, `QUANTITY` | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/analytics/damage-frequency?dateFrom=2026-10-01&dateTo=2026-10-14" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "filters": {
    "allTime": false,
    "dateFrom": "2026-10-01",
    "dateTo": "2026-10-14",
    "facilityAreaId": null,
    "facilityTypeId": null,
    "facilityGroupId": null,
    "facilityId": null,
    "reservationMode": null
  },
  "generatedAt": "2026-10-14T06:00:00.000Z",
  "total": 1,
  "byCategory": [
    {
      "key": "ELECTRICAL_ELECTRONICS",
      "count": 1,
      "label": "Listrik/Elektronik"
    }
  ],
  "byStatus": [
    {
      "key": "NEW",
      "count": 1
    }
  ],
  "byFacility": [
    {
      "key": "22222222-2222-4222-8222-222222222222",
      "facilityId": "22222222-2222-4222-8222-222222222222",
      "assetCode": "R-KLS-101",
      "name": "Ruang Kelas 101",
      "count": 1
    }
  ],
  "byFacilityType": [
    {
      "key": "44444444-4444-4444-8444-444444444444",
      "facilityTypeId": "44444444-4444-4444-8444-444444444444",
      "name": "Ruang Kelas",
      "count": 1
    }
  ],
  "byArea": [
    {
      "key": "55555555-5555-4555-8555-555555555555",
      "id": "55555555-5555-4555-8555-555555555555",
      "code": "TEMBALANG",
      "name": "Kampus Tembalang",
      "count": 1
    }
  ]
}
```

NEW/IN_PROGRESS/RESOLVED dihitung berdasarkan createdAt, tanpa REJECTED. GET menerima allTime=true.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/admin/analytics/trends</strong></summary>

Grafik metrik okupansi/utilisasi/frekuensi menurut hari atau bulan.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/analytics/analytics.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| allTime | query | boolean | Tidak | Query true/false; jika true, tanggal tidak wajib. Dukungan sesuai catatan endpoint. | - |
| dateFrom | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| dateTo | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| facilityAreaId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityTypeId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityGroupId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| reservationMode | query | ReservationMode | Tidak | Pilihan: `EXCLUSIVE`, `QUANTITY` | - |
| metric | query | AnalyticsTrendMetric | Ya | Pilihan: `occupancy`, `equipment-utilization`, `damage-frequency` | - |
| interval | query | AnalyticsTrendInterval | Ya | Pilihan: `day`, `month` | - |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/analytics/trends?dateFrom=2026-10-01&dateTo=2026-10-14&metric=occupancy&interval=day" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "filters": {
    "allTime": false,
    "dateFrom": "2026-10-01",
    "dateTo": "2026-10-14",
    "facilityAreaId": null,
    "facilityTypeId": null,
    "facilityGroupId": null,
    "facilityId": null,
    "reservationMode": null
  },
  "generatedAt": "2026-10-14T06:00:00.000Z",
  "metric": "occupancy",
  "interval": "day",
  "series": [
    {
      "period": "2026-10-14",
      "numerator": 4,
      "denominator": 26,
      "percentage": 15.38
    }
  ]
}
```

metric dan interval wajib. Untuk damage-frequency, item series berisi period/count; dua metrik penggunaan memakai period/numerator/denominator/percentage. Array contoh disingkat.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/admin/analytics/facility-report-history</strong></summary>

Riwayat laporan fasilitas dalam periode rekap.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/analytics/analytics.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| allTime | query | boolean | Tidak | Query true/false; jika true, tanggal tidak wajib. Dukungan sesuai catatan endpoint. | - |
| dateFrom | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| dateTo | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| facilityAreaId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityTypeId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityGroupId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| reservationMode | query | ReservationMode | Tidak | Pilihan: `EXCLUSIVE`, `QUANTITY` | - |
| page | query | integer | Tidak | Nilai minimum 1 | 1 |
| limit | query | integer | Tidak | Nilai minimum 1; Nilai maksimum 100 | 20 |

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/admin/analytics/facility-report-history?dateFrom=2026-10-01&dateTo=2026-10-14&page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "filters": {
    "allTime": false,
    "dateFrom": "2026-10-01",
    "dateTo": "2026-10-14",
    "facilityAreaId": null,
    "facilityTypeId": null,
    "facilityGroupId": null,
    "facilityId": null,
    "reservationMode": null
  },
  "generatedAt": "2026-10-14T06:00:00.000Z",
  "items": [
    {
      "id": "77777777-7777-4777-8777-777777777777",
      "reportNumber": "RPT-20261014060000-ABC123",
      "category": "ELECTRICAL_ELECTRONICS",
      "categoryLabel": "Listrik/Elektronik",
      "status": "NEW",
      "description": "Proyektor di ruang tidak menyala.",
      "facility": {
        "id": "22222222-2222-4222-8222-222222222222",
        "assetCode": "R-KLS-101",
        "name": "Ruang Kelas 101",
        "facilityGroup": {
          "id": "33333333-3333-4333-8333-333333333333",
          "name": "Ruang Kelas 101",
          "reservationMode": "EXCLUSIVE"
        },
        "facilityArea": {
          "id": "55555555-5555-4555-8555-555555555555",
          "code": "TEMBALANG",
          "name": "Kampus Tembalang"
        },
        "facilityType": {
          "id": "44444444-4444-4444-8444-444444444444",
          "name": "Ruang Kelas"
        }
      },
      "reporter": {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Pengguna Demo 01",
        "identityNumber": "24060001",
        "email": "user1@unispace.local"
      },
      "acceptedBy": null,
      "resolvedBy": null,
      "createdAt": "2026-10-14T06:00:00.000Z",
      "acceptedAt": null,
      "resolvedAt": null,
      "resolutionHours": null,
      "decisionReason": null,
      "resolutionNote": null,
      "attachments": [
        {
          "name": "kerusakan.jpg",
          "mimeType": "image/jpeg",
          "sizeBytes": 120000
        }
      ]
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

Pagination ada dalam data bersama filters/generatedAt. GET menerima allTime=true.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>

<details>
<summary><strong>GET /api/v1/admin/analytics/export</strong></summary>

Mengunduh rekap yang mengikuti filter dalam CSV, XLSX, atau PDF.

| Properti | Nilai |
|---|---|
| Akses | ADMIN |
| Request | Tidak ada body |
| Sukses | 200; file binary |
| Acuan | [Controller](unispace-backend/src/analytics/analytics.controller.ts) |

| Parameter | Lokasi | Tipe | Wajib | Aturan | Default |
|---|---|---|---|---|---|
| allTime | query | boolean | Tidak | Query true/false; jika true, tanggal tidak wajib. Dukungan sesuai catatan endpoint. | - |
| dateFrom | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| dateTo | query | string | Jika allTime bukan true | Tanggal ISO 8601; YYYY-MM-DD; Format YYYY-MM-DD | - |
| facilityAreaId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityTypeId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityGroupId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| facilityId | query | string (UUID v4) | Tidak | Sesuai tipe; field lain di luar kontrak ditolak | - |
| reservationMode | query | ReservationMode | Tidak | Pilihan: `EXCLUSIVE`, `QUANTITY` | - |
| report | query | AnalyticsExportReport | Ya | Pilihan: `summary`, `occupancy`, `equipment-utilization`, `damage-frequency`, `trends`, `facility-report-history`, `audit-log` | - |
| format | query | AnalyticsExportFormat | Ya | Pilihan: `csv`, `xlsx`, `pdf` | - |
| metric | query | AnalyticsTrendMetric | Tidak | Pilihan: `occupancy`, `equipment-utilization`, `damage-frequency` | - |
| interval | query | AnalyticsTrendInterval | Tidak | Pilihan: `day`, `month` | - |

**Contoh request**

```bash
curl -sS -X GET "http://localhost:3001/api/v1/admin/analytics/export?dateFrom=2026-10-01&dateTo=2026-10-14&report=summary&format=pdf" \
  -H "Authorization: Bearer <accessToken>" \
  --output rekap.pdf
```

**Respons file**

| Format | Content-Type |
|---|---|
| csv | text/csv; charset=utf-8 |
| xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet |
| pdf | application/pdf |

Content-Disposition: `attachment; filename="<nama-file>"`. Cache-Control: `private, no-store`. Isi respons berupa file, tanpa envelope JSON.

report dan format wajib. Ekspor memerlukan rentang tanggal; allTime=true ditolak pada alur ekspor. report=trends juga memerlukan metric dan interval. report=audit-log memakai rentang tanggal untuk audit; filter actorId/action bukan field AnalyticsExportDto.

| Status gagal utama | Kondisi |
|---|---|
| 400 | Parameter/path/body tidak valid atau aturan domain tidak terpenuhi. |
| 401 | Bearer token tidak ada/tidak valid. |
| 403 | Role atau status akun tidak diizinkan. |

</details>


### Endpoint dasar dan health


| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/v1` | Publik | Endpoint dasar API. |
| GET | `/api/v1/health/live` | Publik | Memeriksa proses API hidup. |
| GET | `/api/v1/health/ready` | Publik | Memeriksa koneksi database dan akses bucket storage. |

<details>
<summary><strong>GET /api/v1</strong></summary>

Endpoint dasar API.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/app.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1"
```

**Contoh isi `data` pada respons sukses**

```json
"Hello World!"
```

</details>

<details>
<summary><strong>GET /api/v1/health/live</strong></summary>

Memeriksa proses API hidup.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/health/health.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/health/live"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "status": "ok",
  "service": "unispace-backend"
}
```

</details>

<details>
<summary><strong>GET /api/v1/health/ready</strong></summary>

Memeriksa koneksi database dan akses bucket storage.

| Properti | Nilai |
|---|---|
| Akses | Publik |
| Request | Tidak ada body |
| Sukses | 200; JSON, lihat isi data di bawah |
| Acuan | [Controller](unispace-backend/src/health/health.controller.ts) |

Tidak ada parameter query, path, atau body tambahan.

**Contoh request**

```bash
curl -i -X GET "http://localhost:3001/api/v1/health/ready"
```

**Contoh isi `data` pada respons sukses**

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "storage": "ok"
  }
}
```

Liveness tidak memeriksa dependency. Readiness mengirim 503 SERVICE_NOT_READY bila database atau bucket gagal.

| Status gagal utama | Kondisi |
|---|---|
| 503 | SERVICE_NOT_READY; error.details berisi status database dan storage. |

</details>

## Deployment Vercel dan Railway

Frontend dan backend memakai repository Git yang sama dengan root directory service berbeda. Panduan ini mempertahankan pola deployment yang tersedia pada konfigurasi proyek.

### Railway: API, database, dan bucket

Buat project dengan environment `production` dan resource:

1. Service PostgreSQL bernama `postgres`.
2. Storage Bucket bernama `files`.
3. Service dari repository bernama `api`, root directory `/unispace-backend`.

Atur service API:

| Setting | Nilai |
|---|---|
| Install variable | `RAILPACK_INSTALL_CMD=npm ci --include=dev` |
| Build command | `npm run db:generate && npm run build` |
| Pre-deploy command | `npm run db:deploy` |
| Start command | `npm run start:prod` |
| Port | Ikuti `PORT` yang diberikan Railway |

Konfigurasi build dan migrasi mengikuti [Railway build configuration](https://docs.railway.com/builds/build-configuration) dan [pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command). Prisma CLI tersedia sebagai dependency production di proyek ini.

```dotenv
APP_ENV=production
DATABASE_URL=${{postgres.DATABASE_URL}}
FRONTEND_URL=https://<domain-frontend-production>
PUBLIC_API_URL=https://<domain-api-railway>/api/v1
JWT_ACCESS_SECRET=<secret-akses-acak>
JWT_REFRESH_SECRET=<secret-refresh-acak-berbeda>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
DEFAULT_USER_PASSWORD=<password-demo-12-sampai-24-karakter>
STORAGE_PROVIDER=S3
S3_ENDPOINT=${{files.ENDPOINT}}
S3_REGION=${{files.REGION}}
S3_BUCKET=${{files.BUCKET}}
S3_ACCESS_KEY=${{files.ACCESS_KEY_ID}}
S3_SECRET_KEY=${{files.SECRET_ACCESS_KEY}}
S3_FORCE_PATH_STYLE=false
```

Tambahkan identitas admin `ADMIN_SEED_NAME`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_IDENTITY_NUMBER`, dan `ADMIN_SEED_PASSWORD` sebelum seed awal. Gunakan credential dari reference service dan bucket agar tidak masuk repository.

### Vercel: frontend

Import repository, pilih root directory `unispace-frontend`, lalu isi environment Production/Preview:

```dotenv
NEXT_PUBLIC_API_URL=/
BACKEND_API_URL=https://<domain-api-railway>
```

`BACKEND_API_URL` hanya origin, tanpa `/api/v1`. Rewrite dalam `next.config.ts` meneruskan `/api/v1/*` melalui domain frontend, sehingga refresh cookie berada pada origin frontend. Build di Vercel gagal bila `BACKEND_API_URL` tidak diisi. Pilih root sesuai [panduan monorepo Vercel](https://vercel.com/docs/monorepos).

Isi `FRONTEND_URL` backend dengan origin frontend production yang persis. Preview yang memakai API dan database sama akan berbagi data demo; dukungan origin Preview perlu disesuaikan dengan konfigurasi CORS backend yang saat ini memakai satu origin.

### Seed awal production

Deploy API dan migrasi terlebih dahulu. Seed awal hanya berjalan dengan `APP_ENV=production`, `STORAGE_PROVIDER=S3`, dan database aplikasi kosong. Isi email admin yang Anda kontrol, NIM/NIP 8 sampai 30 digit yang bukan nilai contoh, serta password admin dan demo berbeda, masing-masing 12 sampai 24 karakter tanpa spasi dan bukan placeholder.

Dari folder backend, setelah [Railway CLI](https://docs.railway.com/cli) terpasang:

```bash
railway login
railway link
railway ssh --service api --environment production -- npm run db:seed:initial
```

Perintah SSH mengakses container API yang aktif dan private network Railway. Railway dapat meminta pendaftaran SSH key pada pemakaian pertama; ikuti [panduan Railway SSH](https://docs.railway.com/cli/ssh).

Seed awal membuat data demo tanpa menghapus data/bucket dan tidak berjalan otomatis saat deploy. Jika penulisan berhenti di tengah, database parsial ditolak pada percobaan berikutnya. Gunakan database baru/kosong hanya bila belum ada data pengguna yang perlu dipertahankan. `npm run db:seed` biasa ditolak pada production.

Simpan database dan bucket sebagai layanan persisten. Kapasitas, biaya, serta retensi paket mengikuti [paket Vercel](https://vercel.com/docs/plans), [paket Railway](https://docs.railway.com/pricing/plans), dan [Storage Buckets Railway](https://docs.railway.com/storage-buckets).

## Referensi dan lisensi

- [PRD Unispace](docs/PRD.md): kebutuhan, aturan bisnis, izin, definisi metrik, dan keputusan produk.
- [Schema Prisma](unispace-backend/prisma/schema.prisma): model, relasi, enum, dan indeks.
- [Migrasi database](unispace-backend/prisma/migrations): constraint SQL dan perubahan schema yang diterapkan saat setup.
- [Compose](docker-compose.yml): layanan database, storage, volume, dan healthcheck lokal.
- [Seed](unispace-backend/prisma/seed.ts): akun serta data demo, reset development, dan seed awal production.
- [Konfigurasi backend](unispace-backend/.env.example) dan [frontend](unispace-frontend/.env.example): contoh variabel lingkungan.

Repository memakai [lisensi MIT](LICENSE), copyright 2026 Yuss. Lisensi layanan eksternal seperti MinIO AIStor mengikuti ketentuan penyedianya.
