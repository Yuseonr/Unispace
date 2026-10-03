import { NestFactory } from '@nestjs/core';
import { AppModule } from './unispace-backend/src/app.module';
import { StaffMaintenanceService } from './unispace-backend/src/facilities/staff-maintenance.service';
import { PrismaService } from './unispace-backend/src/database/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(StaffMaintenanceService);
  const prisma = app.get(PrismaService);
  
  try {
    const facility = await prisma.facility.findFirst();
    const user = await prisma.user.findFirst({ where: { role: 'STAFF' } });
    
    await service.createDirectMaintenance(user.id, facility.id, {
      mode: 'DATE_RANGE' as any,
      startDate: '2026-10-04',
      endDate: '2026-10-05',
      note: 'test script',
      cancellationReason: 'test script',
      cancelImpactedReservations: true
    });
    console.log("SUCCESS");
  } catch(e) {
    console.error("FAILED:");
    console.error(e);
  } finally {
    await app.close();
  }
}
bootstrap();
