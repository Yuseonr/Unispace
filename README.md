# Unispace
Tugas Projek PPK 2026 C - 02.

## Akun demo
- user1@unispace.local<br>
UnispaceDevPass2026!abcd

- staff1@unispace.local<br>
UnispaceDevPass2026!abcd

- admin@unispace.com<br>
UCpSoldfXOeBFWL2XJ5D

## Development

Prerequisite: Node.js dan Docker Desktop.

```bash
cp .env.example .env
cp unispace-backend/.env.example unispace-backend/.env
docker compose up -d
```

Jalankan backend dan migration:

```bash
cd unispace-backend
npm install
npm run db:generate
npm run db:deploy
npm run start:dev
```

Untuk mengisi data demo lokal, aktifkan profile MinIO opsional terlebih dahulu, lalu jalankan `npm run db:seed` dari folder backend. Perintah ini menghapus dan membuat ulang data demo di database serta bucket lokal; jangan jalankan pada data yang ingin dipertahankan.

Jalankan frontend pada terminal lain:

```bash
cd unispace-frontend
npm install
npm run dev
```

## Environment

### Root `.env`

```env
POSTGRES_USER=unispace
POSTGRES_PASSWORD=ganti_password_lokal
POSTGRES_DB=unispace
POSTGRES_PORT=5432

# hapus tanda komentar untuk menjalankan minio
# COMPOSE_PROFILES=minio
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=ganti_password_minio
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
S3_REGION=ap-southeast-1
S3_BUCKET=unispace-dev
```

- `POSTGRES_USER` menentukan nama pengguna database
- `POSTGRES_PASSWORD` menentukan password database dan harus sama dengan password pada `DATABASE_URL` backend
- `POSTGRES_DB` menentukan nama database aplikasi
- `POSTGRES_PORT` menentukan port database di komputer lokal
- `COMPOSE_PROFILES` diisi `minio` bila object storage ingin dijalankan
- `MINIO_ROOT_USER` menentukan nama pengguna admin minio
- `MINIO_ROOT_PASSWORD` menentukan password admin minio
- `MINIO_API_PORT` menentukan port api minio
- `MINIO_CONSOLE_PORT` menentukan port dashboard minio
- `S3_REGION` menentukan region signing MinIO
- `S3_BUCKET` menentukan bucket private yang dibuat otomatis oleh `minio-init`

### Backend `unispace-backend/.env`

```env
APP_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://unispace:ganti_password_lokal@localhost:5432/unispace?schema=public
DEFAULT_USER_PASSWORD=ganti_password_awal
JWT_ACCESS_SECRET=ganti_dengan_secret_panjang
JWT_REFRESH_SECRET=ganti_dengan_secret_panjang_lain
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
STORAGE_PROVIDER=MINIO
S3_ENDPOINT=http://localhost:9000
S3_REGION=ap-southeast-1
S3_BUCKET=unispace-dev
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=ganti_password_minio
S3_FORCE_PATH_STYLE=true
```

- `APP_ENV` menentukan lingkungan aplikasi seperti `development` atau `production`
- `PORT` menentukan port server backend
- `FRONTEND_URL` menentukan asal frontend yang diizinkan mengakses backend
- `DATABASE_URL` menentukan koneksi postgresql dan passwordnya harus sesuai dengan root `.env`
- `DEFAULT_USER_PASSWORD` menentukan password awal akun yang dibuat atau direset admin
- `JWT_ACCESS_SECRET` menentukan secret token akses dan wajib diganti pada setiap environment
- `JWT_REFRESH_SECRET` menentukan secret token refresh dan wajib berbeda dari secret token akses
- `JWT_ACCESS_EXPIRES_IN` menentukan masa berlaku token akses
- `JWT_REFRESH_EXPIRES_IN` menentukan masa berlaku token refresh
- `STORAGE_PROVIDER` memilih provider object storage; gunakan `MINIO` di local
- `S3_ENDPOINT` adalah endpoint MinIO lokal; hapus saat memakai AWS S3
- `S3_BUCKET` adalah bucket penyimpanan file
- `S3_FORCE_PATH_STYLE` harus `true` untuk MinIO lokal

### Frontend `unispace-frontend/.env`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

- `NEXT_PUBLIC_API_URL` menentukan alamat backend yang dipanggil frontend

MinIO bersifat opsional dan memerlukan file `minio.license` lokal di root proyek saat profile `minio` diaktifkan. Saat aktif, `minio-init` membuat `S3_BUCKET` bila belum ada dan memastikan bucket tetap private.

## Deployment: Vercel + Railway

Repo ini berbentuk monorepo. Hubungkan repo Git yang sama ke Vercel dan Railway; frontend dan backend tidak perlu dipisah menjadi repo berbeda.

### Railway: API, database, dan penyimpanan file

Buat project Railway dengan environment `production`, lalu tambahkan resource berikut:

1. Service PostgreSQL bernama `postgres`.
2. Storage Bucket bernama `files`.
3. Service dari repo GitHub bernama `api`, dengan root directory `/unispace-backend`.

Pada service `api`, atur Build Command menjadi `npm run db:generate && npm run build`, Pre-deploy Command menjadi `npm run db:deploy`, dan Start Command menjadi `npm run start:prod`. Tambahkan variabel service `RAILPACK_INSTALL_CMD=npm ci --include=dev` agar dependency untuk build Nest tersedia. Prisma CLI menjadi dependency production agar command migrasi tersedia di image pre-deploy. Railway menyediakan `PORT`; jangan isi port production secara manual. Lihat dokumentasi [Railway build configuration](https://docs.railway.com/builds/build-configuration) dan [pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command).

Isi variables berikut di service `api`. Gunakan reference Railway untuk koneksi database dan bucket agar credential tidak masuk Git:

```env
APP_ENV=production
DATABASE_URL=${{postgres.DATABASE_URL}}
FRONTEND_URL=https://<vercel-production-domain>
PUBLIC_API_URL=https://<railway-api-domain>/api/v1
JWT_ACCESS_SECRET=<unique-random-secret>
JWT_REFRESH_SECRET=<different-unique-random-secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
DEFAULT_USER_PASSWORD=<random-12-to-24-character-password>
STORAGE_PROVIDER=S3
S3_ENDPOINT=${{files.ENDPOINT}}
S3_REGION=${{files.REGION}}
S3_BUCKET=${{files.BUCKET}}
S3_ACCESS_KEY=${{files.ACCESS_KEY_ID}}
S3_SECRET_KEY=${{files.SECRET_ACCESS_KEY}}
S3_FORCE_PATH_STYLE=false
```

Setelah Railway memberikan domain HTTPS untuk API, isi `PUBLIC_API_URL` dengan domain tersebut. Bucket bersifat private; API yang menyajikan gambar. Akun pengguna dan staff demo memakai password bersama dari `DEFAULT_USER_PASSWORD`, sedangkan akun admin memakai `ADMIN_SEED_PASSWORD`. Data akun ini hanya untuk demo.

### Vercel: frontend

Import repo yang sama ke Vercel, lalu pilih root directory relatif `unispace-frontend` ([panduan monorepo Vercel](https://vercel.com/docs/monorepos)). Tambahkan project variables untuk environment Production dan Preview:

```env
NEXT_PUBLIC_API_URL=/
BACKEND_API_URL=https://<railway-api-domain>
```

`BACKEND_API_URL` hanya origin API Railway, tanpa `/api/v1`. Rewrite frontend meneruskan `/api/v1/*` ke Railway melalui domain Vercel supaya cookie refresh tetap first-party. Isi `FRONTEND_URL` di Railway dengan origin Vercel production yang persis.

Untuk demo, Production dan Preview boleh memakai domain API Railway yang sama. Keduanya akan memakai database dan bucket demo yang sama. Build Vercel sengaja gagal jika `BACKEND_API_URL` tidak diisi.

### Menjalankan seed demo awal satu kali

Deploy API terlebih dahulu agar migrasi database sudah dijalankan. Sebelum menjalankan seed, isi `ADMIN_SEED_EMAIL`, `ADMIN_SEED_IDENTITY_NUMBER`, `ADMIN_SEED_PASSWORD`, dan `DEFAULT_USER_PASSWORD` di Railway. Gunakan email admin yang kamu kontrol dan nomor identitas 8–30 digit. Kedua password harus berbeda, bukan nilai contoh, dan masing-masing 12–24 karakter tanpa spasi. Seed satu kali ini membuat akun demo, katalog fasilitas, reservasi, laporan, dan gambar. Seed hanya berjalan di production dengan database aplikasi kosong; ia tidak menghapus data maupun isi bucket dan tidak berjalan otomatis saat deploy.

Jalankan dari folder `unispace-backend` setelah Railway CLI login dan terhubung ke project yang benar. Perintah ini masuk ke container API yang aktif supaya dapat mengakses database dan bucket lewat private network Railway ([panduan Railway SSH](https://docs.railway.com/cli/ssh)). Pada penggunaan pertama, Railway mungkin meminta kamu mendaftarkan SSH key:

```bash
railway login
railway link
railway ssh --service api --environment production -- npm run db:seed:initial
```

Jika seed berhenti setelah mulai menulis data, database parsial akan ditolak saat dicoba ulang. Hanya reset atau ganti database baru itu bila belum ada data pengguna sungguhan, lalu jalankan seed lagi. `npm run db:seed` biasa tetap digunakan untuk mengulang data development lokal.

### Catatan biaya dan penyimpanan

Vercel Hobby gratis untuk project personal non-komersial. Railway Free memberikan kredit pemakaian bulanan $1 setelah trial 30 hari senilai $5; API dan database yang selalu aktif dapat memakai kredit lebih dari itu. Storage Bucket ditagih $0.015 per GB per bulan, di luar pemakaian service. Railway Buckets private dan file disajikan lewat API ([panduan Storage Bucket Railway](https://docs.railway.com/storage-buckets)). Railway juga menyebut volume dari masa trial akan dihapus 30 hari setelah kredit trial habis kecuali akun di-upgrade. Export database atau tentukan paket berbayar sebelum mengandalkan data trial untuk jangka panjang. Lihat [paket Vercel Hobby](https://vercel.com/docs/plans/hobby), [harga Railway](https://docs.railway.com/pricing/plans), [harga Storage Bucket Railway](https://docs.railway.com/storage-buckets/billing), dan [retensi data trial Railway](https://docs.railway.com/pricing/free-trial).
