import 'source-map-support/register';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

import { NestFactory } from '@nestjs/core';
import { AppModule } from '@gitroom/orchestrator/app.module';
import { Logger } from 'nestjs-pino';
import * as dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  // some comment again
  const app = await NestFactory.createApplicationContext(AppModule, {
    // Buffer logs during bootstrap; pino takes over after useLogger call
    bufferLogs: true,
  });
  // SOCIAL COMMAND CENTRE — Phase 8: Structured JSON logging for worker processes (NF5.4)
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

bootstrap();
