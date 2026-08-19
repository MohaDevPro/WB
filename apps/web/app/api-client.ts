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

export type Organization = Readonly<{
  description: string | null;
  id: string;
  memberCount: number;
  name: string;
  slug: string;
}>;

export type Expert = Readonly<{
  availability: string;
  displayName: string;
  headline: string;
  isVerified: boolean;
  specialties: readonly string[];
  userId: string;
}>;

export type LearningPath = Readonly<{
  id: string;
  moduleCount: number;
  summary: string;
  title: string;
}>;

export type ServiceRequest = Readonly<{
  createdAt: string;
  id: string;
  message: string;
  priceMinor: number | null;
  serviceTitle: string;
  status: string;
}>;

export type PaymentIntent = Readonly<{
  amountMinor: number;
  currency: string;
  id: string;
  provider: string;
  serviceRequestId: string;
  status: string;
}>;

export type Review = Readonly<{
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  rating: number;
  serviceRequestId: string;
}>;

export type SearchResult = Readonly<{
  description: string;
  id: string;
  title: string;
  type: 'community' | 'event' | 'expert' | 'learning_path' | 'opportunity' | 'service';
}>;

export type AssistantGuidance = Readonly<{
  answer: string;
  citations: readonly SearchResult[];
  taskId: string;
}>;

export type Workflow = Readonly<{
  createdAt: string;
  id: string;
  resultSummary: string | null;
  status: string;
  workflowType: string;
}>;

export type FederationLink = Readonly<{
  id: string;
  remoteBaseUrl: string;
  remoteCommunityKey: string;
  status: string;
  trustLevel: string;
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
  approveWorkflow: (token: string, id: string) =>
    request<Workflow>(`/v1/workflows/${encodeURIComponent(id)}/approve`, { method: 'POST', token }),
  askAssistant: (token: string, prompt: string) =>
    request<AssistantGuidance>('/v1/assistant/messages', {
      body: { prompt },
      method: 'POST',
      token,
    }),
  confirmPaymentIntent: (token: string, id: string) =>
    request<PaymentIntent>(`/v1/payment-intents/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
      token,
    }),
  createCommunity: (
    token: string,
    body: Readonly<{
      name: string;
      slug?: string;
      summary: string;
      visibility?: 'private' | 'public';
    }>,
  ) => request<Community>('/v1/communities', { body, method: 'POST', token }),
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
  createFederationLink: (
    token: string,
    communitySlug: string,
    body: Readonly<{ remoteBaseUrl: string; remoteCommunityKey: string }>,
  ) =>
    request<FederationLink>(
      `/v1/communities/${encodeURIComponent(communitySlug)}/federation-links`,
      { body, method: 'POST', token },
    ),
  createLearningPath: (
    token: string,
    body: Readonly<{
      modules: readonly Readonly<{ content: string; title: string }>[];
      summary: string;
      title: string;
      visibility?: 'private' | 'public';
    }>,
  ) => request<LearningPath>('/v1/learning-paths', { body, method: 'POST', token }),
  createOpportunity: (
    token: string,
    body: Readonly<{
      description: string;
      title: string;
      type: 'mentorship' | 'partnership' | 'project' | 'role';
    }>,
  ) => request<Opportunity>('/v1/opportunities', { body, method: 'POST', token }),
  createOrganization: (
    token: string,
    body: Readonly<{ description?: string; name: string; slug?: string }>,
  ) => request<Organization>('/v1/organizations', { body, method: 'POST', token }),
  createPaymentIntent: (
    token: string,
    serviceRequestId: string,
    provider: 'local-sandbox' | 'mada' | 'stc_pay',
  ) =>
    request<PaymentIntent>(
      `/v1/service-requests/${encodeURIComponent(serviceRequestId)}/payment-intents`,
      { body: { provider }, method: 'POST', token },
    ),
  createService: (
    token: string,
    body: Readonly<{
      currency: 'SAR';
      description: string;
      priceMinor: number | null;
      title: string;
    }>,
  ) => request<Service>('/v1/services', { body, method: 'POST', token }),
  createReview: (
    token: string,
    body: Readonly<{ body: string; rating: number; serviceRequestId: string }>,
  ) => request<Review>('/v1/reviews', { body, method: 'POST', token }),
  createWorkflow: (
    token: string,
    workflowType: 'community_digest' | 'event_follow_up' | 'opportunity_match',
  ) =>
    request<Readonly<{ id: string; status: string }>>('/v1/workflows', {
      body: { workflowType },
      method: 'POST',
      token,
    }),
  enrollInLearningPath: (token: string, id: string) =>
    request<Readonly<{ status: string }>>(
      `/v1/learning-paths/${encodeURIComponent(id)}/enrollments`,
      {
        method: 'POST',
        token,
      },
    ),
  getCurrentUser: (token: string) => request<CurrentUser>('/v1/auth/me', { token }),
  getExperts: () => request<readonly Expert[]>('/v1/experts'),
  getFederationLinks: (communitySlug: string) =>
    request<readonly FederationLink[]>(
      `/v1/communities/${encodeURIComponent(communitySlug)}/federation-links`,
    ),
  getHome: () => request<PlatformHome>('/v1/platform/home'),
  getLearningPaths: () => request<readonly LearningPath[]>('/v1/learning-paths'),
  getNotifications: (token: string) =>
    request<readonly Notification[]>('/v1/me/notifications', { token }),
  getOrganizations: () => request<readonly Organization[]>('/v1/organizations'),
  getPaymentIntents: (token: string) =>
    request<readonly PaymentIntent[]>('/v1/me/payments', { token }),
  getProfile: (token: string) => request<Profile>('/v1/me/profile', { token }),
  getRecommendations: (token: string) =>
    request<readonly Recommendation[]>('/v1/me/recommendations', { token }),
  getServiceRequests: (token: string) =>
    request<readonly ServiceRequest[]>('/v1/me/service-requests', { token }),
  getServiceReviews: (serviceId: string) =>
    request<readonly Review[]>(`/v1/services/${encodeURIComponent(serviceId)}/reviews`),
  getWorkflows: (token: string) => request<readonly Workflow[]>('/v1/me/workflows', { token }),
  joinCommunity: (token: string, slug: string) =>
    request<Readonly<{ joined: true }>>(`/v1/communities/${encodeURIComponent(slug)}/join`, {
      method: 'POST',
      token,
    }),
  login: (email: string, password: string) =>
    request<Session>('/v1/auth/login', { body: { email, password }, method: 'POST' }),
  logout: (token: string) =>
    request<Readonly<{ revoked: true }>>('/v1/auth/logout', { method: 'POST', token }),
  markNotificationRead: (token: string, id: string) =>
    request<Readonly<{ read: true }>>(`/v1/me/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      token,
    }),
  openServiceDispute: (token: string, serviceRequestId: string, reason: string) =>
    request<Readonly<{ id: string; status: string }>>(
      `/v1/service-requests/${encodeURIComponent(serviceRequestId)}/disputes`,
      { body: { reason }, method: 'POST', token },
    ),
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
  search: (query: string) =>
    request<readonly SearchResult[]>(`/v1/search?q=${encodeURIComponent(query)}`),
  updateExpertProfile: (
    token: string,
    body: Readonly<{
      availability: 'limited' | 'open' | 'unavailable';
      headline: string;
      specialties: readonly string[];
    }>,
  ) => request<Expert>('/v1/me/expert-profile', { body, method: 'PUT', token }),
  updateProfile: (token: string, body: Profile) =>
    request<Profile>('/v1/me/profile', { body, method: 'PUT', token }),
  updateServiceRequestStatus: (
    token: string,
    id: string,
    action: 'accept' | 'accept_delivery' | 'cancel' | 'decline' | 'deliver',
  ) =>
    request<Readonly<{ status: string }>>(`/v1/service-requests/${encodeURIComponent(id)}/status`, {
      body: { action },
      method: 'POST',
      token,
    }),
});
