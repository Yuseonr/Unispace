const REQUIRED_ENV = [
  'DATABASE_URL',
  'FRONTEND_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
] as const;

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED_ENV.filter((name) => {
    const value = config[name];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const storageProvider = String(
    config.STORAGE_PROVIDER ?? 'MINIO',
  ).toUpperCase();
  if (storageProvider !== 'MINIO' && storageProvider !== 'S3') {
    throw new Error('STORAGE_PROVIDER must be MINIO or S3');
  }

  return {
    ...config,
    APP_ENV: config.APP_ENV ?? 'development',
    PORT: port,
    STORAGE_PROVIDER: storageProvider,
  };
}
