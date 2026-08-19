export type Session = Readonly<{
  accessToken: string;
  expiresAt: string;
  identity: Readonly<{ issuer: string; subject: string }>;
}>;

export type CurrentUser = Readonly<{
  email: string;
  id: string;
  roles: readonly string[];
}>;

export type Profile = Readonly<{
  biography: string | null;
  displayName: string;
  locale: 'ar' | 'en';
  skills: readonly string[];
}>;

export type Community = Readonly<{
  id: string;
  memberCount: number;
  name: string;
  slug: string;
  summary: string;
  visibility: string;
}>;

export type Discussion = Readonly<{
  authorName: string;
  body: string;
  communityName: string;
  createdAt: string;
  id: string;
  reactionCount: number;
  title: string;
}>;

export type PlatformEvent = Readonly<{
  capacity: number | null;
  description: string;
  id: string;
  location: string | null;
  registrationState: string;
  startsAt: string;
  title: string;
  type: string;
}>;

export type Opportunity = Readonly<{
  description: string;
  id: string;
  title: string;
  type: string;
}>;

export type Service = Readonly<{
  currency: string;
  description: string;
  id: string;
  priceMinor: number | null;
  title: string;
}>;

export type Notification = Readonly<{
  body: string;
  createdAt: string;
  href: string | null;
  id: string;
  readAt: string | null;
  title: string;
}>;

export type Recommendation = Readonly<{
  reason: string;
  resourceId: string;
  type: string;
}>;

export type PlatformHome = Readonly<{
  communities: readonly Community[];
  discussions: readonly Discussion[];
  events: readonly PlatformEvent[];
  opportunities: readonly Opportunity[];
  services: readonly Service[];
}>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Readonly<{
  body?: unknown;
  method?: 'GET' | 'POST' | 'PUT';
  token?: string;
}>;

const apiBasePath = '/backend';

async function request<Result>(path: string, options: RequestOptions = {}): Promise<Result> {
  const response = await fetch(`${apiBasePath}${path}`, {
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
    },
    method: options.method ?? 'GET',
  });

  const text = await response.text();
  const payload: unknown = text.length === 0 ? undefined : JSON.parse(text);

  if (!response.ok) {
    const detail =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String(payload.message)
        : 'The request could not be completed.';
    throw new ApiError(detail, response.status);
  }

  return payload as Result;
}

export const api = Object.freeze({
  createAiTask: (token: string, taskType: 'moderation' | 'recommendation' | 'summary') =>
    request<Readonly<{ id: string; status: string }>>('/v1/ai/tasks', {
      body: { taskType },
      method: 'POST',
      token,
    }),
  createDiscussion: (
    token: string,
    body: Readonly<{ body: string; communitySlug: string; title: string }>,
  ) => request<Discussion>('/v1/discussions', { body, method: 'POST', token }),
  createWorkflow: (
    token: string,
    workflowType: 'community_digest' | 'event_follow_up' | 'opportunity_match',
  ) =>
    request<Readonly<{ id: string; status: string }>>('/v1/workflows', {
      body: { workflowType },
      method: 'POST',
      token,
    }),
  getCurrentUser: (token: string) => request<CurrentUser>('/v1/auth/me', { token }),
  getHome: () => request<PlatformHome>('/v1/platform/home'),
  getNotifications: (token: string) =>
    request<readonly Notification[]>('/v1/me/notifications', { token }),
  getProfile: (token: string) => request<Profile>('/v1/me/profile', { token }),
  getRecommendations: (token: string) =>
    request<readonly Recommendation[]>('/v1/me/recommendations', { token }),
  joinCommunity: (token: string, slug: string) =>
    request<Readonly<{ joined: true }>>(`/v1/communities/${encodeURIComponent(slug)}/join`, {
      method: 'POST',
      token,
    }),
  login: (email: string, password: string) =>
    request<Session>('/v1/auth/login', { body: { email, password }, method: 'POST' }),
  logout: (token: string) =>
    request<Readonly<{ revoked: true }>>('/v1/auth/logout', { method: 'POST', token }),
  reactToDiscussion: (token: string, id: string) =>
    request<Readonly<{ reacted: true }>>(`/v1/discussions/${encodeURIComponent(id)}/reactions`, {
      method: 'POST',
      token,
    }),
  register: (email: string, password: string) =>
    request<Session>('/v1/auth/register', { body: { email, password }, method: 'POST' }),
  registerForEvent: (token: string, id: string) =>
    request<Readonly<{ status: string }>>(`/v1/events/${encodeURIComponent(id)}/register`, {
      method: 'POST',
      token,
    }),
  requestService: (token: string, id: string, message: string) =>
    request<Readonly<{ id: string; status: string }>>(
      `/v1/services/${encodeURIComponent(id)}/requests`,
      {
        body: { idempotencyKey: crypto.randomUUID(), message },
        method: 'POST',
        token,
      },
    ),
  updateProfile: (token: string, body: Profile) =>
    request<Profile>('/v1/me/profile', { body, method: 'PUT', token }),
});
