import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import bcrypt from 'bcrypt';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AccountStatus,
  FacilityAreaStatus,
  FacilityStatus,
  PrismaClient,
  ReportCategory,
  ReportStatus,
  ReservationMode,
  ReservationStatus,
  StorageProvider,
  UserRole,
} from '../src/generated/prisma/client';
import { BCRYPT_ROUNDS } from '../src/accounts/auth/password.constants';

type FacilitySeed = {
  asset: string;
  assetCode: string;
  area: string;
  capacity: number | null;
  description: string;
  location: string;
  mode: ReservationMode;
  name: string;
  type: string;
  units?: number;
};

const ASSET_DIRECTORY = resolve(process.cwd(), 'prisma/seed-asset');
const API_BASE_URL =
  process.env.PUBLIC_API_URL?.replace(/\/$/, '') ??
  'http://localhost:3001/api/v1';
const FACILITIES: FacilitySeed[] = [
  [
    'aula_auditorium.webp',
    'UNDIP-AUD-001',
    'TEMBALANG',
    600,
    'Auditorium kampus untuk kuliah umum, wisuda, dan acara institusional.',
    'Gedung Serbaguna, Kampus Tembalang',
    'EXCLUSIVE',
    'Auditorium Universitas',
    'Aula',
  ],
  [
    'aula_seminar.webp',
    'UNDIP-SEM-001',
    'TEMBALANG',
    180,
    'Aula seminar dengan proyektor dan tata suara untuk kegiatan akademik.',
    'Gedung Dekanat, Lantai 2',
    'EXCLUSIVE',
    'Aula Seminar Tembalang',
    'Aula',
  ],
  [
    'aula_sidang_utama.webp',
    'UNDIP-SID-001',
    'REKTORAT',
    80,
    'Ruang sidang utama untuk rapat pimpinan dan agenda formal universitas.',
    'Rektorat, Lantai 2',
    'EXCLUSIVE',
    'Ruang Sidang Utama',
    'Ruang Rapat',
  ],
  [
    'lab_komputer_1.webp',
    'UNDIP-LK-101',
    'TEMBALANG',
    40,
    'Laboratorium komputer untuk praktikum dan pelatihan perangkat lunak.',
    'Gedung Informatika, Ruang 101',
    'EXCLUSIVE',
    'Laboratorium Komputer 1',
    'Laboratorium',
  ],
  [
    'lab_komputer_2.webp',
    'UNDIP-LK-202',
    'TEMBALANG',
    36,
    'Laboratorium komputer dengan workstation untuk kelas praktik terjadwal.',
    'Gedung Informatika, Ruang 202',
    'EXCLUSIVE',
    'Laboratorium Komputer 2',
    'Laboratorium',
  ],
  [
    'lab_komputer_jaringan.webp',
    'UNDIP-LJ-301',
    'TEMBALANG',
    32,
    'Laboratorium jaringan untuk praktikum infrastruktur dan administrasi jaringan.',
    'Gedung Informatika, Ruang 301',
    'EXCLUSIVE',
    'Laboratorium Jaringan',
    'Laboratorium',
  ],
  [
    'lab_elektronika.webp',
    'UNDIP-LE-210',
    'TEMBALANG',
    28,
    'Laboratorium elektronika untuk eksperimen rangkaian dan instrumentasi.',
    'Gedung Teknik, Ruang 210',
    'EXCLUSIVE',
    'Laboratorium Elektronika',
    'Laboratorium',
  ],
  [
    'lab_kimia_1.webp',
    'UNDIP-LKIM-110',
    'TEMBALANG',
    30,
    'Laboratorium kimia dasar dengan meja kerja dan perlengkapan keselamatan.',
    'Gedung Sains, Ruang 110',
    'EXCLUSIVE',
    'Laboratorium Kimia Dasar',
    'Laboratorium',
  ],
  [
    'lab_kimia_praktikum.webp',
    'UNDIP-LKIM-220',
    'TEMBALANG',
    30,
    'Laboratorium praktikum kimia untuk kegiatan eksperimen terstruktur.',
    'Gedung Sains, Ruang 220',
    'EXCLUSIVE',
    'Laboratorium Praktikum Kimia',
    'Laboratorium',
  ],
  [
    'lab_radiasi.webp',
    'UNDIP-LRAD-101',
    'TEMBALANG',
    20,
    'Laboratorium radiasi dengan akses terbatas untuk praktikum terawasi.',
    'Gedung Sains, Ruang 101',
    'EXCLUSIVE',
    'Laboratorium Radiasi',
    'Laboratorium',
  ],
  [
    'ruangan_kelas_teori_1.webp',
    'UNDIP-RK-A101',
    'TEMBALANG',
    45,
    'Ruang kelas teori untuk perkuliahan dan diskusi akademik.',
    'Gedung A, Ruang 101',
    'EXCLUSIVE',
    'Ruang Kelas A101',
    'Ruang Kelas',
  ],
  [
    'ruangan_kelas_teori_2.webp',
    'UNDIP-RK-B204',
    'TEMBALANG',
    50,
    'Ruang kelas teori dengan papan tulis dan tata kursi fleksibel.',
    'Gedung B, Ruang 204',
    'EXCLUSIVE',
    'Ruang Kelas B204',
    'Ruang Kelas',
  ],
  [
    'ruangan_kelas_komputer.webp',
    'UNDIP-RKK-105',
    'PLEBURAN',
    28,
    'Ruang kelas komputer untuk pelatihan dan kelas berbasis perangkat.',
    'Gedung Pleburan, Ruang 105',
    'EXCLUSIVE',
    'Ruang Kelas Komputer',
    'Ruang Kelas',
  ],
  [
    'ruangan_perpustakaan.webp',
    'UNDIP-PERP-01',
    'TEMBALANG',
    100,
    'Ruang baca dan diskusi terbuka di perpustakaan kampus.',
    'Perpustakaan Pusat, Lantai 1',
    'EXCLUSIVE',
    'Ruang Diskusi Perpustakaan',
    'Ruang Rapat',
  ],
  [
    'ruangan_sidang.webp',
    'UNDIP-RS-305',
    'PLEBURAN',
    24,
    'Ruang rapat kecil untuk sidang, presentasi, dan koordinasi tim.',
    'Gedung Pleburan, Ruang 305',
    'EXCLUSIVE',
    'Ruang Sidang Pleburan',
    'Ruang Rapat',
  ],
  [
    'alat_proyektor.webp',
    'UNDIP-PRJ',
    'FASILITAS_UMUM',
    null,
    'Proyektor portabel untuk kegiatan presentasi dan pembelajaran.',
    'Pusat Media, Gedung A',
    'QUANTITY',
    'Proyektor Epson EB-X06',
    'Peralatan',
    10,
  ],
  [
    'alat_mikroskop_digital.webp',
    'UNDIP-MIC',
    'TEMBALANG',
    null,
    'Mikroskop digital untuk pengamatan dan dokumentasi praktikum.',
    'Laboratorium Sains, Ruang 115',
    'QUANTITY',
    'Mikroskop Digital',
    'Peralatan',
    6,
  ],
  [
    'alat_mesin_cnc.webp',
    'UNDIP-CNC',
    'TEMBALANG',
    null,
    'Perangkat mesin CNC untuk praktikum manufaktur dan prototyping.',
    'Workshop Teknik, Ruang 012',
    'QUANTITY',
    'Mesin CNC Mini',
    'Peralatan',
    3,
  ],
  [
    'alat_praktikum_telekomunikasi.webp',
    'UNDIP-TEL',
    'TEMBALANG',
    null,
    'Kit praktikum telekomunikasi untuk pengujian jaringan dan sinyal.',
    'Laboratorium Telekomunikasi, Ruang 312',
    'QUANTITY',
    'Kit Praktikum Telekomunikasi',
    'Peralatan',
    8,
  ],
  [
    'Jierui-Mini-Sliding-Table-Saw-Machine-Woodworking-Folding-Panel-Saw-Machine.webp',
    'UNDIP-SAW',
    'TEMBALANG',
    null,
    'Mesin potong meja untuk workshop kayu dengan penggunaan terawasi.',
    'Workshop Teknik, Ruang 014',
    'QUANTITY',
    'Mesin Potong Meja',
    'Peralatan',
    2,
  ],
  [
    'no-brand_meja-kuliah-serba-guna-bisa-di-lipat-kursi-kuliah_full01.webp',
    'UNDIP-MKS',
    'FASILITAS_UMUM',
    null,
    'Meja kursi lipat untuk kelas lapangan dan acara kampus.',
    'Gudang Fasilitas Umum',
    'QUANTITY',
    'Meja Kuliah Serbaguna',
    'Peralatan',
    25,
  ],
].map(
  ([
    asset,
    assetCode,
    area,
    capacity,
    description,
    location,
    mode,
    name,
    type,
    units,
  ]) => ({
    asset,
    assetCode,
    area,
    capacity,
    description,
    location,
    mode: mode as ReservationMode,
    name,
    type,
    units,
  }),
) as FacilitySeed[];

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured before seeding.`);
  return value;
}
function toDate(offset: number, hour = 9) {
  const jakartaNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const date = new Date(
    Date.UTC(
      jakartaNow.getUTCFullYear(),
      jakartaNow.getUTCMonth(),
      jakartaNow.getUTCDate(),
    ),
  );
  date.setUTCDate(date.getUTCDate() + offset);
  date.setUTCHours(hour - 7, 0, 0, 0);
  return date;
}
function operationalDate(offset: number) {
  const date = toDate(offset, 12);
  while ([0, 6].includes(date.getUTCDay()))
    date.setUTCDate(date.getUTCDate() + 1);
  return date;
}
function time(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}
function addMinutes(value: string, minutes: number) {
  const [hour, minute] = value.split(':').map(Number);
  const totalMinutes = hour * 60 + minute + minutes;
  const endHour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const endMinute = String(totalMinutes % 60).padStart(2, '0');
  return `${endHour}:${endMinute}`;
}
function publicImageUrl(fileName: string) {
  return `${API_BASE_URL}/facilities/images/${encodeURIComponent(fileName)}`;
}

async function clearBucket(client: S3Client, bucket: string) {
  let continuationToken: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );
    const objects =
      page.Contents?.flatMap((item) => (item.Key ? [{ Key: item.Key }] : [])) ??
      [];
    if (objects.length)
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );
    continuationToken = page.NextContinuationToken;
  } while (continuationToken);
}

async function upload(
  storage: S3Client,
  bucket: string,
  asset: string,
  objectKey: string,
) {
  const body = await readFile(resolve(ASSET_DIRECTORY, asset));
  await storage.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: 'image/webp',
    }),
  );
  return body.byteLength;
}

async function seed() {
  if (process.env.APP_ENV?.trim().toLowerCase() === 'production')
    throw new Error('Refusing destructive demo seed in APP_ENV=production.');
  const bucket = required('S3_BUCKET');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required('DATABASE_URL') }),
  });
  const storage = new S3Client({
    endpoint: required('S3_ENDPOINT'),
    region: required('S3_REGION'),
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY'),
      secretAccessKey: required('S3_SECRET_KEY'),
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  });
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "idempotency_records", "audit_logs", "maintenance_periods", "report_attachments", "facility_reports", "reservation_items", "reservations", "facility_status_history", "facilities", "facility_groups", "facility_areas", "facility_types", "users" RESTART IDENTITY CASCADE',
    );
    await clearBucket(storage, bucket);
    const defaultPassword = required('DEFAULT_USER_PASSWORD');
    const [adminHash, demoHash] = await Promise.all([
      bcrypt.hash(
        process.env.ADMIN_SEED_PASSWORD?.trim() || defaultPassword,
        BCRYPT_ROUNDS,
      ),
      bcrypt.hash(defaultPassword, BCRYPT_ROUNDS),
    ]);
    const admin = await prisma.user.create({
      data: {
        name: process.env.ADMIN_SEED_NAME?.trim() || 'Administrator Unispace',
        identityNumber:
          process.env.ADMIN_SEED_IDENTITY_NUMBER?.trim() || '00000000',
        email: process.env.ADMIN_SEED_EMAIL?.trim() || 'admin@unispace.local',
        passwordHash: adminHash,
        role: UserRole.ADMIN,
        accountStatus: AccountStatus.ACTIVE,
      },
    });
    const staff = await Promise.all(
      ['Aulia Pratama', 'Dimas Setiawan', 'Nadia Lestari'].map((name, index) =>
        prisma.user.create({
          data: {
            name,
            identityNumber: `1987000${index + 1}`,
            email: `staff${index + 1}@unispace.local`,
            passwordHash: demoHash,
            role: UserRole.STAFF,
            accountStatus: AccountStatus.ACTIVE,
            verifiedById: admin.id,
            verifiedAt: toDate(-90),
          },
        }),
      ),
    );
    const users = await Promise.all(
      Array.from({ length: 16 }, (_, index) => {
        const number = index + 1;
        const status =
          number <= 12
            ? AccountStatus.ACTIVE
            : number <= 14
              ? AccountStatus.PENDING_VERIFICATION
              : number === 15
                ? AccountStatus.REJECTED
                : AccountStatus.NONACTIVE;
        return prisma.user.create({
          data: {
            name: `Pengguna Demo ${String(number).padStart(2, '0')}`,
            identityNumber: `24060${String(number).padStart(3, '0')}`,
            email: `user${number}@unispace.local`,
            passwordHash: demoHash,
            role: UserRole.USER,
            accountStatus: status,
            verificationReason:
              status === AccountStatus.REJECTED
                ? 'Data registrasi belum dapat diverifikasi.'
                : null,
            verifiedById:
              status === AccountStatus.ACTIVE ||
              status === AccountStatus.REJECTED
                ? admin.id
                : null,
            verifiedAt:
              status === AccountStatus.ACTIVE ||
              status === AccountStatus.REJECTED
                ? toDate(-40 + number)
                : null,
          },
        });
      }),
    );
    const types = await Promise.all(
      ['Aula', 'Laboratorium', 'Peralatan', 'Ruang Kelas', 'Ruang Rapat'].map(
        (name) => prisma.facilityType.create({ data: { name } }),
      ),
    );
    const areas = await Promise.all(
      [
        { code: 'TEMBALANG', name: 'Kampus Tembalang' },
        { code: 'PLEBURAN', name: 'Kampus Pleburan' },
        { code: 'REKTORAT', name: 'Rektorat' },
        { code: 'FASILITAS_UMUM', name: 'Fasilitas Umum' },
      ].map((area) =>
        prisma.facilityArea.create({
          data: { ...area, status: FacilityAreaStatus.ACTIVE },
        }),
      ),
    );
    const typeByName = new Map(types.map((item) => [item.name, item.id]));
    const areaByCode = new Map(areas.map((item) => [item.code, item.id]));
    const physical: Array<{
      asset: string;
      groupId: string;
      id: string;
      mode: ReservationMode;
    }> = [];
    for (const [facilityIndex, definition] of FACILITIES.entries()) {
      const fileName = `00000000-0000-4000-8000-${String(facilityIndex + 1).padStart(12, '0')}.webp`;
      const objectKey = `facility-primary/${fileName}`;
      await upload(storage, bucket, definition.asset, objectKey);
      const group = await prisma.facilityGroup.create({
        data: {
          name: definition.name,
          facilityTypeId: typeByName.get(definition.type)!,
          reservationMode: definition.mode,
          facilityAreaId: areaByCode.get(definition.area)!,
          locationDetail: definition.location,
          capacity: definition.capacity,
          description: definition.description,
          primaryImageObjectKey: objectKey,
          primaryImageUrl: publicImageUrl(fileName),
        },
      });
      const count =
        definition.mode === ReservationMode.QUANTITY ? definition.units! : 1;
      for (let index = 0; index < count; index += 1) {
        const assetCode =
          count === 1
            ? definition.assetCode
            : `${definition.assetCode}-${String(index + 1).padStart(3, '0')}`;
        const unit = await prisma.facility.create({
          data: {
            facilityGroupId: group.id,
            assetCode,
            name:
              definition.mode === ReservationMode.EXCLUSIVE
                ? definition.name
                : null,
            capacity: definition.capacity,
            description:
              definition.mode === ReservationMode.EXCLUSIVE
                ? definition.description
                : null,
            primaryImageObjectKey: objectKey,
            primaryImageUrl: publicImageUrl(fileName),
            status: FacilityStatus.ACTIVE,
            // Riwayat reservasi demo dimulai jauh sebelum tanggal seed dijalankan.
            // Analytics memakai createdAt sebagai batas kapasitas historis.
            createdAt: toDate(-120, 7),
          },
        });
        physical.push({
          asset: definition.asset,
          groupId: group.id,
          id: unit.id,
          mode: definition.mode,
        });
      }
    }
    const exclusive = physical.filter(
      (item) => item.mode === ReservationMode.EXCLUSIVE,
    );
    const quantity = physical.filter(
      (item) => item.mode === ReservationMode.QUANTITY,
    );
    const quantityGroups = Array.from(
      new Map(quantity.map((item) => [item.groupId, item])).values(),
    );
    const completed = operationalDate(-21);
    const approved = operationalDate(4);
    const pending = operationalDate(6);
    const rejected = operationalDate(-7);
    const nonactiveEffectiveAt = toDate(-3);
    const dateOffset = (date: Date) =>
      Math.round((date.getTime() - toDate(0, 12).getTime()) / 86_400_000);
    const completedOffset = dateOffset(completed);
    const rejectedOffset = dateOffset(rejected);
    const nonactiveOffset = dateOffset(nonactiveEffectiveAt);
    const reservations = await Promise.all([
      prisma.reservation.create({
        data: {
          reservationNumber: 'RSV-DEMO-001',
          userId: users[0].id,
          facilityId: exclusive[0].id,
          usageDate: completed,
          startTime: time('09:00'),
          endTime: time('11:00'),
          purpose: 'Seminar akademik',
          status: ReservationStatus.COMPLETED,
          createdAt: toDate(-30),
          decisionDeadline: toDate(-23, 13),
          processedById: staff[0].id,
          decidedAt: toDate(-24),
          items: { create: { facilityId: exclusive[0].id } },
        },
      }),
      prisma.reservation.create({
        data: {
          reservationNumber: 'RSV-DEMO-002',
          userId: users[1].id,
          facilityId: exclusive[1].id,
          usageDate: approved,
          startTime: time('13:00'),
          endTime: time('15:00'),
          purpose: 'Rapat organisasi mahasiswa',
          status: ReservationStatus.APPROVED,
          createdAt: toDate(-3),
          decisionDeadline: toDate(1, 13),
          processedById: staff[1].id,
          decidedAt: toDate(-1),
          items: { create: { facilityId: exclusive[1].id } },
        },
      }),
      prisma.reservation.create({
        data: {
          reservationNumber: 'RSV-DEMO-003',
          userId: users[2].id,
          facilityGroupId: quantity[0].groupId,
          requestedQuantity: 3,
          usageDate: approved,
          startTime: time('09:00'),
          endTime: time('12:00'),
          purpose: 'Presentasi proyek akhir',
          status: ReservationStatus.APPROVED,
          createdAt: toDate(-3),
          decisionDeadline: toDate(1, 13),
          processedById: staff[0].id,
          decidedAt: toDate(-1),
          items: {
            create: quantity
              .filter((item) => item.groupId === quantity[0].groupId)
              .slice(0, 3)
              .map((item) => ({ facilityId: item.id })),
          },
        },
      }),
      prisma.reservation.create({
        data: {
          reservationNumber: 'RSV-DEMO-004',
          userId: users[3].id,
          facilityId: exclusive[2].id,
          usageDate: pending,
          startTime: time('10:00'),
          endTime: time('12:00'),
          purpose: 'Diskusi penelitian',
          status: ReservationStatus.PENDING,
          createdAt: toDate(-1),
          decisionDeadline: toDate(1, 13),
        },
      }),
      prisma.reservation.create({
        data: {
          reservationNumber: 'RSV-DEMO-005',
          userId: users[4].id,
          facilityGroupId: quantity[10].groupId,
          requestedQuantity: 2,
          usageDate: pending,
          startTime: time('13:00'),
          endTime: time('16:00'),
          purpose: 'Praktikum observasi',
          status: ReservationStatus.PENDING,
          createdAt: toDate(-1),
          decisionDeadline: toDate(1, 13),
        },
      }),
      prisma.reservation.create({
        data: {
          reservationNumber: 'RSV-DEMO-006',
          userId: users[5].id,
          facilityId: exclusive[3].id,
          usageDate: rejected,
          startTime: time('08:00'),
          endTime: time('10:00'),
          purpose: 'Kelas tambahan',
          status: ReservationStatus.REJECTED,
          createdAt: toDate(-12),
          decisionDeadline: toDate(-9, 13),
          processedById: staff[2].id,
          decidedAt: toDate(-8),
          decisionReason: 'Fasilitas tidak tersedia pada jadwal tersebut.',
        },
      }),
      prisma.reservation.create({
        data: {
          reservationNumber: 'RSV-DEMO-007',
          userId: users[6].id,
          facilityId: exclusive[4].id,
          usageDate: operationalDate(8),
          startTime: time('15:00'),
          endTime: time('17:00'),
          purpose: 'Pelatihan internal',
          status: ReservationStatus.CANCELLED_BY_USER,
          createdAt: toDate(-4),
          decisionDeadline: toDate(2, 13),
          cancelledAt: toDate(-1),
          decisionReason: 'Dibatalkan oleh pengguna.',
        },
      }),
    ]);
    const historicalStatuses: ReservationStatus[] = [
      ReservationStatus.COMPLETED,
      ReservationStatus.COMPLETED,
      ReservationStatus.REJECTED,
      ReservationStatus.CANCELLED_BY_USER,
      ReservationStatus.COMPLETED,
      ReservationStatus.CANCELLED_BY_STAFF,
      ReservationStatus.COMPLETED,
      ReservationStatus.CANCELLED_BY_SYSTEM,
      ReservationStatus.REJECTED,
      ReservationStatus.COMPLETED,
      ReservationStatus.COMPLETED,
      ReservationStatus.CANCELLED_BY_STAFF,
    ];
    const historicalOffsets = Array.from(
      { length: 30 },
      (_, index) => index - 30,
    ).filter((offset) => {
      const weekday = toDate(offset, 12).getUTCDay();
      return weekday !== 0 && weekday !== 6;
    });
    const timeSlots = [
      ['07:00', '09:00'],
      ['09:30', '11:30'],
      ['11:30', '13:30'],
      ['13:30', '15:30'],
      ['16:00', '18:00'],
    ] as const;
    const historicalPurposes = [
      'Kuliah tamu dan diskusi akademik',
      'Praktikum terjadwal',
      'Rapat dan koordinasi kegiatan kampus',
      'Pelatihan organisasi mahasiswa',
      'Presentasi tugas akhir',
      'Kegiatan penelitian dosen dan mahasiswa',
    ];
    const historicalReservations = await Promise.all(
      historicalOffsets.flatMap((offset, dayIndex) =>
        timeSlots.flatMap(([startTime, endTime], slotIndex) => {
          // Keep this fixture for equipment only; room occupancy is seeded
          // separately at a controlled share of each day's room capacity.
          if (slotIndex % 2 === 0) return [];
          const index = dayIndex * timeSlots.length + slotIndex;
          const status = historicalStatuses[index % historicalStatuses.length];
          const target = quantityGroups[
            (dayIndex * 2 + Math.floor(slotIndex / 2)) % quantityGroups.length
          ];
          const targetUnits = quantity.filter(
            (item) => item.groupId === target.groupId,
          );
          const requestedQuantity = Math.min(
            1 + (dayIndex % 3),
            targetUnits.length,
          );
          return [
            prisma.reservation.create({
              data: {
                reservationNumber: `RSV-HISTORY-${String(index + 1).padStart(3, '0')}`,
                userId: users[index % 10].id,
                facilityGroupId: target.groupId,
                requestedQuantity,
                usageDate: toDate(offset, 12),
                startTime: time(startTime),
                endTime: time(endTime),
                purpose: historicalPurposes[index % historicalPurposes.length],
                status,
                createdAt: toDate(offset - 6),
                decisionDeadline: toDate(offset - 4, 13),
                processedById:
                  status === ReservationStatus.CANCELLED_BY_USER
                    ? null
                    : staff[index % staff.length].id,
                decidedAt:
                  status === ReservationStatus.CANCELLED_BY_USER
                    ? null
                    : toDate(offset - 5, 11),
                cancelledAt: status.startsWith('CANCELLED')
                  ? toDate(offset - 1, 14)
                  : null,
                decisionReason:
                  status === ReservationStatus.REJECTED
                    ? 'Permohonan historis tidak dapat dipenuhi pada waktu tersebut.'
                    : status.startsWith('CANCELLED')
                      ? 'Pembatalan pada data demo historis.'
                      : null,
                ...(status === ReservationStatus.COMPLETED
                  ? {
                      items: {
                        create: targetUnits
                          .slice(0, requestedQuantity)
                          .map((item) => ({ facilityId: item.id })),
                      },
                    }
                  : {}),
              },
            }),
          ];
        }),
      ),
    );
    const roomOccupancyOffsets = Array.from(
      { length: 121 },
      (_, index) => index - 120,
    ).filter((offset) => {
      const weekday = toDate(offset, 12).getUTCDay();
      return weekday >= 1 && weekday <= 5;
    });
    const roomStartTimes = ['07:00', '09:00', '11:30', '13:30', '16:30'];
    const roomPurposes = [
      'Perkuliahan dan diskusi kelas',
      'Praktikum terjadwal',
      'Rapat dan koordinasi kegiatan kampus',
      'Bimbingan dan presentasi akademik',
      'Pelatihan organisasi mahasiswa',
      'Kegiatan penelitian dosen dan mahasiswa',
    ];
    const roomOccupancyRows = roomOccupancyOffsets.flatMap((offset, dayIndex) => {
      const usageDate = toDate(offset, 12);
      const operationalFacilities = exclusive.filter(
        (facility) =>
          !(offset >= nonactiveOffset && facility.id === exclusive[9].id),
      );
      const availableSlots =
        offset === nonactiveOffset
          ? operationalFacilities.length * 26 + 4
          : operationalFacilities.length * 26;
      const existingBookedSlots = offset === completedOffset ? 4 : 0;
      const targetBookedSlots = Math.round(availableSlots * 0.2);
      const slotsToSeed = targetBookedSlots - existingBookedSlots;
      const baseSlotsPerFacility = Math.floor(
        slotsToSeed / operationalFacilities.length,
      );
      const extraSlots = slotsToSeed % operationalFacilities.length;
      const firstExtraFacilityIndex = offset === completedOffset ? 1 : 0;
      const extraFacilityIndices = new Set(
        Array.from({ length: extraSlots }, (_, index) =>
          (firstExtraFacilityIndex + index) % operationalFacilities.length,
        ),
      );

      return operationalFacilities.map((facility, facilityIndex) => {
        const durationSlots =
          baseSlotsPerFacility + Number(extraFacilityIndices.has(facilityIndex));
        const durationMinutes = durationSlots * 30;
        let startTime =
          offset === -120
            ? '09:00'
            : roomStartTimes[
                ((dayIndex + facilityIndex) % roomStartTimes.length +
                  roomStartTimes.length) %
                  roomStartTimes.length
              ];
        if (offset === completedOffset && facility.id === exclusive[0].id) {
          startTime = '11:30';
        }
        if (offset === rejectedOffset && facility.id === exclusive[3].id) {
          startTime = '10:00';
        }
        const isToday = offset === 0;
        const dateCode = usageDate.toISOString().slice(0, 10).replaceAll('-', '');
        const sequence = String(facilityIndex + 1).padStart(3, '0');

        return {
          reservationNumber: `RSV-OCC-${dateCode}-${sequence}`,
          data: {
            userId: users[(dayIndex + facilityIndex) % users.length].id,
            facilityId: facility.id,
            usageDate,
            startTime: time(startTime),
            endTime: time(addMinutes(startTime, durationMinutes)),
            purpose: roomPurposes[(dayIndex + facilityIndex) % roomPurposes.length],
            status: isToday
              ? ReservationStatus.APPROVED
              : ReservationStatus.COMPLETED,
            createdAt:
              offset === -120
                ? toDate(offset, 8)
                : isToday
                  ? toDate(-1, 9)
                  : toDate(offset - 6),
            decisionDeadline: isToday
              ? toDate(1, 13)
              : toDate(offset - 4, 13),
            processedById: staff[(dayIndex + facilityIndex) % staff.length].id,
            decidedAt:
              offset === -120
                ? toDate(offset, 8)
                : isToday
                  ? toDate(-1, 11)
                  : toDate(offset - 5, 11),
            items: { create: { facilityId: facility.id } },
          },
        };
      });
    });
    const roomOccupancyReservations: Awaited<
      ReturnType<typeof prisma.reservation.create>
    >[] = [];
    for (let index = 0; index < roomOccupancyRows.length; index += 50) {
      const batch = await Promise.all(
        roomOccupancyRows
          .slice(index, index + 50)
          .map(({ reservationNumber, data }) =>
            prisma.reservation.create({ data: { reservationNumber, ...data } }),
          ),
      );
      roomOccupancyReservations.push(...batch);
    }
    type ReportSeed = readonly [
      ReportCategory,
      (typeof physical)[number],
      (typeof users)[number],
      ReportStatus,
      string,
    ];
    const reportSeeds: ReportSeed[] = [
      [
        ReportCategory.ELECTRICAL_ELECTRONICS,
        exclusive[5],
        users[0],
        ReportStatus.NEW,
        'Salah satu komputer tidak dapat menyala saat praktikum.',
      ],
      [
        ReportCategory.PHYSICAL_DAMAGE,
        exclusive[6],
        users[1],
        ReportStatus.IN_PROGRESS,
        'Panel meja kerja elektronik retak dan perlu diperiksa.',
      ],
      [
        ReportCategory.CLEANLINESS,
        exclusive[7],
        users[2],
        ReportStatus.RESOLVED,
        'Area wastafel laboratorium perlu dibersihkan.',
      ],
      [
        ReportCategory.OTHER,
        quantity[0],
        users[3],
        ReportStatus.REJECTED,
        'Label inventaris proyektor tidak terbaca.',
      ],
      [
        ReportCategory.SECURITY,
        exclusive[0],
        users[4],
        ReportStatus.IN_PROGRESS,
        'Pintu samping auditorium tidak menutup rapat.',
      ],
      [
        ReportCategory.FURNITURE_EQUIPMENT,
        quantity.at(-1)!,
        users[5],
        ReportStatus.RESOLVED,
        'Satu meja lipat memiliki pengunci yang longgar.',
      ],
      [
        ReportCategory.PHYSICAL_DAMAGE,
        exclusive[10],
        users[6],
        ReportStatus.NEW,
        'Kursi kelas bagian belakang perlu diperbaiki.',
      ],
      [
        ReportCategory.ELECTRICAL_ELECTRONICS,
        exclusive[11],
        users[7],
        ReportStatus.IN_PROGRESS,
        'Lampu proyektor kelas berkedip saat digunakan.',
      ],
      [
        ReportCategory.CLEANLINESS,
        exclusive[12],
        users[8],
        ReportStatus.RESOLVED,
        'Meja dan perangkat kelas komputer telah dibersihkan.',
      ],
      [
        ReportCategory.SECURITY,
        exclusive[13],
        users[9],
        ReportStatus.REJECTED,
        'Laporan akses ruang tidak memiliki bukti kondisi terkini.',
      ],
      [
        ReportCategory.OTHER,
        quantity[16],
        users[10],
        ReportStatus.IN_PROGRESS,
        'Kit praktikum memerlukan pemeriksaan kelengkapan kabel.',
      ],
      [
        ReportCategory.FURNITURE_EQUIPMENT,
        exclusive[14],
        users[11],
        ReportStatus.RESOLVED,
        'Kursi ruang sidang telah diperbaiki oleh petugas.',
      ],
    ];
    const reportCategories = Object.values(ReportCategory);
    const additionalReportStatuses = [
      ReportStatus.NEW,
      ReportStatus.IN_PROGRESS,
      ReportStatus.RESOLVED,
      ReportStatus.REJECTED,
      ReportStatus.IN_PROGRESS,
      ReportStatus.RESOLVED,
    ];
    const additionalReportDescriptions = [
      'Kabel daya terlihat longgar dan perlu diperiksa sebelum digunakan kembali.',
      'Permukaan meja mengalami kerusakan ringan setelah kegiatan praktikum.',
      'Area fasilitas perlu dibersihkan setelah digunakan untuk kegiatan kampus.',
      'Perangkat tidak merespons saat diuji pada awal kegiatan.',
      'Kelengkapan alat perlu diperiksa karena ada bagian yang belum ditemukan.',
      'Lampu indikator fasilitas berkedip ketika perangkat dinyalakan.',
      'Kunci pintu terasa macet dan perlu dijadwalkan untuk perbaikan.',
      'Kondisi kursi dan meja perlu ditinjau sebelum jadwal penggunaan berikutnya.',
    ];
    const additionalReportSeeds: ReportSeed[] = Array.from(
      { length: 8 },
      (_, index) => [
        reportCategories[index % reportCategories.length],
        physical[(index * 7 + 3) % physical.length],
        users[(index + 4) % 12],
        additionalReportStatuses[index % additionalReportStatuses.length],
        additionalReportDescriptions[
          index % additionalReportDescriptions.length
        ],
      ],
    );
    const allReportSeeds = [...reportSeeds, ...additionalReportSeeds];
    for (const [
      index,
      [category, facility, reporter, status, description],
    ] of allReportSeeds.entries()) {
      const reportOffset =
        -30 + Math.floor((index * 29) / (allReportSeeds.length - 1));
      const report = await prisma.facilityReport.create({
        data: {
          reportNumber: `RPT-DEMO-${String(index + 1).padStart(3, '0')}`,
          reporterId: reporter.id,
          facilityId: facility.id,
          category,
          description,
          status,
          createdAt: toDate(reportOffset, 9),
          acceptedById:
            status !== ReportStatus.NEW ? staff[index % staff.length].id : null,
          acceptedAt:
            status !== ReportStatus.NEW ? toDate(reportOffset, 11) : null,
          resolvedById:
            status === ReportStatus.RESOLVED
              ? staff[index % staff.length].id
              : null,
          resolvedAt:
            status === ReportStatus.RESOLVED ? toDate(reportOffset, 16) : null,
          processedById:
            status !== ReportStatus.NEW ? staff[index % staff.length].id : null,
          decisionReason:
            status === ReportStatus.REJECTED
              ? 'Laporan telah ditangani pada tiket fasilitas lain.'
              : null,
          resolutionNote:
            status === ReportStatus.RESOLVED
              ? 'Kendala telah diperbaiki dan fasilitas dapat digunakan kembali.'
              : null,
        },
      });
      const objectKey = `reports/seed-${report.reportNumber.toLowerCase()}.webp`;
      const sizeBytes = await upload(
        storage,
        bucket,
        facility.asset,
        objectKey,
      );
      await prisma.reportAttachment.create({
        data: {
          reportId: report.id,
          storageProvider: StorageProvider.MINIO,
          objectKey,
          objectUrl: `s3://${bucket}/${objectKey}`,
          originalFilename: facility.asset,
          mimeType: 'image/webp',
          sizeBytes,
        },
      });
      if (index === 1)
        await prisma.maintenancePeriod.create({
          data: {
            reportId: report.id,
            facilityId: facility.id,
            startAt: toDate(-1, 7),
            endAt: toDate(2, 20),
            note: 'Perbaikan panel meja kerja elektronik.',
          },
        });
      if (index === 4)
        await prisma.maintenancePeriod.create({
          data: {
            reportId: report.id,
            facilityId: facility.id,
            startAt: toDate(7, 7),
            endAt: toDate(9, 20),
            note: 'Penggantian komponen pengunci pintu.',
          },
        });
    }
    await prisma.facility.update({
      where: { id: exclusive[9].id },
      data: { status: FacilityStatus.NONACTIVE },
    });
    await prisma.facilityStatusHistory.create({
      data: {
        facilityId: exclusive[9].id,
        status: FacilityStatus.NONACTIVE,
        changedById: admin.id,
        effectiveAt: nonactiveEffectiveAt,
      },
    });
    const allReservations = [
      ...reservations,
      ...historicalReservations,
      ...roomOccupancyReservations,
    ];
    await prisma.auditLog.createMany({
      data: [
        {
          actorId: admin.id,
          action: 'DEMO_SEED_COMPLETED',
          entityType: 'USER',
          entityId: admin.id,
          metadata: {
            facilityGroups: FACILITIES.length,
            physicalUnits: physical.length,
            reservations: allReservations.length,
            users: users.length,
            staff: staff.length,
            reports: allReportSeeds.length,
          },
        },
        ...allReservations.map((reservation) => ({
          actorId: reservation.processedById,
          action: `RESERVATION_${reservation.status}`,
          entityType: 'RESERVATION',
          entityId: reservation.id,
          metadata: { source: 'DEMO_SEED' },
        })),
      ],
    });
    console.log(
      `Demo seed complete: ${FACILITIES.length} facility groups, ${physical.length} physical units, ${users.length} users, ${staff.length} staff, ${allReservations.length} reservations, and ${allReportSeeds.length} reports.`,
    );
    console.log(
      'Demo user and staff passwords use DEFAULT_USER_PASSWORD; admin uses ADMIN_SEED_PASSWORD when configured.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
