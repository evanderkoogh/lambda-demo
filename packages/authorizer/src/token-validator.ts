import jwt from 'jsonwebtoken';
import type { AuthorizerContext } from '@frontend-demo/shared';

const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret';

export function validateToken(token: string): AuthorizerContext {
  const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

  if (!payload.sub || !payload.email) {
    throw new Error('Token missing required claims');
  }

  return {
    userId: payload.sub,
    email: payload.email as string,
  };
}
