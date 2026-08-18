export type AuthenticatedIdentity = Readonly<{
  issuer: string;
  subject: string;
}>;

export type RequestWithIdentity = {
  headers: Record<string, string | string[] | undefined>;
  identity?: AuthenticatedIdentity;
};

export function getBearerToken(
  authorizationHeader: string | string[] | undefined,
): string | undefined {
  if (typeof authorizationHeader !== 'string') {
    return undefined;
  }

  const [scheme, token, ...additionalParts] = authorizationHeader.trim().split(/\s+/u);

  if (
    scheme !== 'Bearer' ||
    token === undefined ||
    additionalParts.length !== 0 ||
    token.length === 0
  ) {
    return undefined;
  }

  return token;
}
