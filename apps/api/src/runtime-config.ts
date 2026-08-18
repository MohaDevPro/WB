import { getApiRuntimeConfig, type ApiRuntimeConfig } from '@wb/config';

export const API_RUNTIME_CONFIG = Symbol('API_RUNTIME_CONFIG');

export const apiRuntimeConfigProvider = {
  provide: API_RUNTIME_CONFIG,
  useFactory: (): ApiRuntimeConfig => getApiRuntimeConfig(),
};
