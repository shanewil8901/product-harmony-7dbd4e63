import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { repairOrphanForeignKeys } from './database/pre-sync-repair';

async function bootstrap() {
  // Legacy rows may still point at deleted/free-text vendors, currencies, etc.
  // Clear those dangling pointers before TypeORM tries to add the constraints,
  // otherwise startup fails with "a foreign key constraint fails".
  try {
    await repairOrphanForeignKeys();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db-repair] skipped:', (err as Error).message);
  }

  // Allowed browser origins come from the environment (comma separated).
  // Empty / unset keeps the permissive default used in local development.
  const corsOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const app = await NestFactory.create(AppModule, {
    cors: corsOrigins.length ? { origin: corsOrigins, credentials: true } : true,
  });

  const apiPrefix = (process.env.API_PREFIX ?? 'api/v1').replace(/^\/|\/$/g, '');
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      errorHttpStatusCode: 422,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new ResponseInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT ?? 3000);
  // Public base URL of this API (behind ingress / reverse proxy). Falls back to
  // localhost so nothing changes for local development.
  const publicUrl = (process.env.PUBLIC_API_URL ?? process.env.APP_URL ?? `http://localhost:${port}`)
    .replace(/\/$/, '');

  const config = new DocumentBuilder()
    .setTitle('Product Management API')
    .setDescription('CRUD + search API for Products with JWT auth')
    .setVersion('1.0')
    .addServer(publicUrl)
    .addBearerAuth()
    .addTag('auth')
    .addTag('products')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API:     ${publicUrl}/${apiPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger: ${publicUrl}/api/docs`);
}
bootstrap();
