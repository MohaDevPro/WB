import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { getApiRuntimeConfig } from '@wb/config';
import helmet from 'helmet';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const runtimeConfig = getApiRuntimeConfig();
  const application = await NestFactory.create(AppModule);

  application.use(helmet());
  application.setGlobalPrefix('api');

  if (runtimeConfig.nodeEnv !== 'production') {
    application.enableCors({
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH'],
      origin: ['http://127.0.0.1:3000', 'http://localhost:3000'],
    });
  }

  await application.listen(runtimeConfig.port, runtimeConfig.host);
}

void bootstrap();
