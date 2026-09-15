import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/api/v1 (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect(({ body, headers }) => {
        expect(body).toMatchObject({
          success: true,
          statusCode: 200,
          data: 'Hello World!',
        });
        expect(body.requestId).toBe(headers['x-request-id']);
        expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
