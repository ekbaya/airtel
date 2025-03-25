import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  const configService = app.get(ConfigService);
  const allowedOrigins = (
    configService.get<string>('ALLOWED_ORIGINS') || ''
  ).split(',');

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (allowedOrigins.indexOf(origin || '') !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['POST', 'PUT', 'PATCH', 'DELETE', 'GET', 'OPTIONS'],
  });

  const port = parseInt(configService.get<string>('PORT') || '3000');
  await app.listen(port);
  console.log("Dr Frankenstein: It's Alive! It's Alive!");
}
bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
