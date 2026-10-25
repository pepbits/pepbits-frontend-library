import './env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json, text } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '5mb' }));
  // Instrument messages (HL7 v2 / ASTM) arrive as plain text.
  app.use(text({ type: ['text/*', 'application/hl7-v2', 'x-application/hl7-v2+er7', 'application/edi-hl7'], limit: '5mb' }));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','), credentials: true });
  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`LIS API listening on http://localhost:${port}/api`);
}
bootstrap();
