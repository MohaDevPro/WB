export type HealthStatus = 'ok';

export type HealthResponse = Readonly<{
  status: HealthStatus;
}>;
