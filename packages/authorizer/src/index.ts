import type { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from '@frontend-demo/shared';
import { logger } from '@frontend-demo/shared';
import { validateToken } from './token-validator.js';
import { buildPolicy } from './policy-builder.js';

const log = logger.child({ lambda: 'authorizer' });

export async function handler(
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> {
  const token = event.authorizationToken?.replace(/^Bearer\s+/i, '');

  if (!token) {
    log.warn('No token provided');
    throw new Error('Unauthorized');
  }

  try {
    const authContext = validateToken(token);
    log.info({ userId: authContext.userId }, 'Token validated successfully');

    return buildPolicy(authContext.userId, 'Allow', event.methodArn, {
      userId: authContext.userId,
      email: authContext.email,
    });
  } catch (err) {
    log.warn({ err }, 'Token validation failed');
    throw new Error('Unauthorized');
  }
}
