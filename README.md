# Unispace
Tugas Projek PPK 2026 C - 02.

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
