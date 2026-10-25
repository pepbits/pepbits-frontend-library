import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { AppModule } from './app.module';

/** Minimal .env loader (no extra dependency). Real environment variables win. */
function loadEnv() {
  const file = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function bootstrap() {
  loadEnv();
  // Optional native TLS: set TLS_CERT and TLS_KEY (PEM file paths) to serve the API over HTTPS.
  const httpsOptions = process.env.TLS_CERT && process.env.TLS_KEY
    ? { cert: fs.readFileSync(process.env.TLS_CERT), key: fs.readFileSync(process.env.TLS_KEY) }
    : undefined;
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, httpsOptions });
  // JSON (incl. FHIR) and raw text bodies (HL7 v2 / ASTM) for integration endpoints.
  app.use(express.json({ limit: '10mb', type: ['application/json', 'application/fhir+json', 'application/*+json'] }));
  app.use(express.text({ limit: '10mb', type: ['text/*', 'x-application/hl7-v2+er7', 'application/hl7-v2', 'application/edi-hl7', 'application/x-hl7', 'application/astm'] }));
  app.use(express.urlencoded({ extended: true }));
  app.setGlobalPrefix('api');
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim());
  app.enableCors({ origin: origins.includes('*') ? true : origins, credentials: true, exposedHeaders: ['x-message-id'] });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  new Logger('LIS').log(`API listening on ${httpsOptions ? 'https' : 'http'}://localhost:${port}/api`);
}
bootstrap();
