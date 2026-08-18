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

  await application.listen(runtimeConfig.port, runtimeConfig.host);
}

void bootstrap();
