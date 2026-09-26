import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ReportsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
