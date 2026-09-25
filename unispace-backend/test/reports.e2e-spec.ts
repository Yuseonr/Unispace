import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

describe('Reports endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('requires authentication to read the staff reports queue', async () => {
    await request(app.getHttpServer()).get('/api/v1/staff/reports').expect(401);
  });

  it('requires authentication to read my own reports', async () => {
    await request(app.getHttpServer()).get('/api/v1/reports/me').expect(401);
  });

  it('requires authentication to confirm a maintenance period', async () => {
    await request(app.getHttpServer())
      .post(
        '/api/v1/staff/reports/00000000-0000-4000-8000-000000000000/maintenance',
      )
      .send({
        mode: 'DATE_RANGE',
        startDate: '2027-01-11',
        endDate: '2027-01-11',
        cancelImpactedReservations: true,
        cancellationReason: 'Pemeliharaan AC',
      })
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
