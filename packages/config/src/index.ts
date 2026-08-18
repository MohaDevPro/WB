export type NodeEnvironment = 'development' | 'test' | 'production';

export type OidcRuntimeConfig = Readonly<{
  audience: string;
  issuer: URL;
  jwksUri: URL;
}>;

export type ApiRuntimeConfig = Readonly<{
  databaseUrl?: string;
  host: string;
  nodeEnv: NodeEnvironment;
  oidc?: OidcRuntimeConfig;
  port: number;
}>;

const allowedNodeEnvironments = new Set<NodeEnvironment>(['development', 'test', 'production']);

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

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  const nodeEnvironment = value ?? 'development';

  if (!allowedNodeEnvironments.has(nodeEnvironment as NodeEnvironment)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  return nodeEnvironment as NodeEnvironment;
}

function parseOptionalUrl(value: string, variableName: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${variableName} must be an absolute URL.`);
  }
}

function parseOptionalOidcConfiguration(
  environment: NodeJS.ProcessEnv,
): OidcRuntimeConfig | undefined {
  const rawIssuer = environment.OIDC_ISSUER?.trim();
  const rawAudience = environment.OIDC_AUDIENCE?.trim();
  const rawJwksUri = environment.OIDC_JWKS_URI?.trim();
  const providedValueCount = [rawIssuer, rawAudience, rawJwksUri].filter(Boolean).length;

  if (providedValueCount === 0) {
    return undefined;
  }

  if (providedValueCount !== 3) {
    throw new Error('OIDC_ISSUER, OIDC_AUDIENCE, and OIDC_JWKS_URI must be configured together.');
  }

  return Object.freeze({
    audience: rawAudience as string,
    issuer: parseOptionalUrl(rawIssuer as string, 'OIDC_ISSUER'),
    jwksUri: parseOptionalUrl(rawJwksUri as string, 'OIDC_JWKS_URI'),
  });
}

export function getApiRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApiRuntimeConfig {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const oidc = parseOptionalOidcConfiguration(environment);

  if (databaseUrl !== undefined && databaseUrl.length === 0) {
    throw new Error('DATABASE_URL cannot be empty when configured.');
  }

  return Object.freeze({
    ...(databaseUrl === undefined ? {} : { databaseUrl }),
    host: environment.HOST?.trim() || '127.0.0.1',
    nodeEnv: parseNodeEnvironment(environment.NODE_ENV),
    ...(oidc === undefined ? {} : { oidc }),
    port: parsePort(environment.PORT),
  });
}
