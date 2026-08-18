export type ApiRuntimeConfig = Readonly<{
  host: string;
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
}>;

const allowedNodeEnvironments = new Set<ApiRuntimeConfig['nodeEnv']>([
  'development',
  'test',
  'production',
]);

function parsePort(value: string | undefined): number {
  if (value === undefined || value.length === 0) {
    return 3001;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return parsedValue;
}

function parseNodeEnvironment(value: string | undefined): ApiRuntimeConfig['nodeEnv'] {
  const nodeEnvironment = value ?? 'development';

  if (!allowedNodeEnvironments.has(nodeEnvironment as ApiRuntimeConfig['nodeEnv'])) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  return nodeEnvironment as ApiRuntimeConfig['nodeEnv'];
}

export function getApiRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApiRuntimeConfig {
  return Object.freeze({
    host: environment.HOST?.trim() || '127.0.0.1',
    port: parsePort(environment.PORT),
    nodeEnv: parseNodeEnvironment(environment.NODE_ENV),
  });
}
