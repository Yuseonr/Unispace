import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountsModule } from './accounts/accounts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PrismaModule } from './database/prisma.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { ReportsModule } from './reports/reports.module';
import { ReservationsModule } from './reservations/reservations.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AccountsModule,
    FacilitiesModule,
    ReservationsModule,
    ReportsModule,
    AnalyticsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
