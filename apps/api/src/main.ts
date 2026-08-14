import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ApiExceptionFilter, SuccessEnvelopeInterceptor } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new SuccessEnvelopeInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', '*')
      .split(',')
      .map((origin) => origin.trim()),
  });
  app.enableShutdownHooks();
  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
}
void bootstrap();
