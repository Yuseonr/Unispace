import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AccountStatus,
  PrismaClient,
  UserRole,
} from '../src/generated/prisma/client';
import { BCRYPT_ROUNDS } from '../src/accounts/auth/password.constants';

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured before seeding.`);
  }
  return value;
}

function optionalEnvironment(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

async function seedFacilityMasterData(prisma: PrismaClient) {
  const typeNames = [
    'Aula',
    'Laboratorium',
    'Peralatan',
    'Ruang Kelas',
    'Ruang Rapat',
  ];
  const areas = [
    { code: 'PLEBURAN', name: 'Kampus Pleburan' },
    { code: 'TEMBALANG', name: 'Kampus Tembalang' },
  ];

  await Promise.all(
    typeNames.map((name) =>
      prisma.facilityType.upsert({
        where: { name },
        create: { name },
        update: {},
      }),
    ),
  );
  await Promise.all(
    areas.map(({ code, name }) =>
      prisma.facilityArea.upsert({
        where: { code },
        create: { code, name },
        update: {},
      }),
    ),
  );
  console.log('Facility master seed is ready.');
}

async function seedAdmin(prisma: PrismaClient) {
  const email = optionalEnvironment('ADMIN_SEED_EMAIL', 'admin@unispace.local');
  const identityNumber = optionalEnvironment(
    'ADMIN_SEED_IDENTITY_NUMBER',
    '00000000',
  );

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (existingByEmail) {
    if (existingByEmail.role !== UserRole.ADMIN) {
      throw new Error(
        'ADMIN_SEED_EMAIL is already assigned to a non-admin account.',
      );
    }
    console.log('Admin seed already exists; no account was changed.');
    return;
  }

  const existingByIdentity = await prisma.user.findUnique({
    where: { identityNumber },
  });
  if (existingByIdentity) {
    throw new Error(
      'ADMIN_SEED_IDENTITY_NUMBER is already assigned to another account.',
    );
  }

  const password =
    process.env.ADMIN_SEED_PASSWORD?.trim() ||
    requiredEnvironment('DEFAULT_USER_PASSWORD');
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const admin = await prisma.user.create({
    data: {
      name: optionalEnvironment('ADMIN_SEED_NAME', 'Administrator Unispace'),
      identityNumber,
      email,
      passwordHash,
      role: UserRole.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'ADMIN_ACCOUNT_SEEDED',
      entityType: 'USER',
      entityId: admin.id,
    },
  });
  console.log(`Admin seed created for ${admin.email}.`);
}

async function seed() {
  const connectionString = requiredEnvironment('DATABASE_URL');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await seedFacilityMasterData(prisma);
    await seedAdmin(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
