import type { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from '@frontend-demo/shared';
import { logger, initTracer, flushTracer, SpanStatusCode } from '@frontend-demo/shared';
import { validateToken } from './token-validator.js';
import { buildPolicy } from './policy-builder.js';

const log = logger.child({ lambda: 'authorizer' });
const tracer = initTracer();

export async function handler(
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> {
  return tracer.startActiveSpan('authorizer.handler', async (span) => {
    try {
      const token = event.authorizationToken?.replace(/^Bearer\s+/i, '');

      if (!token) {
        log.warn('No token provided');
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'No token provided' });
        throw new Error('Unauthorized');
      }

      try {
        const authContext = validateToken(token);
        log.info({ userId: authContext.userId }, 'Token validated successfully');
        span.setAttribute('user.id', authContext.userId);
        span.setStatus({ code: SpanStatusCode.OK });

        return buildPolicy(authContext.userId, 'Allow', event.methodArn, {
          userId: authContext.userId,
          email: authContext.email,
        });
      } catch (err) {
        log.warn({ err }, 'Token validation failed');
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Token validation failed' });
        throw new Error('Unauthorized');
      }
    } finally {
      span.end();
      await flushTracer();
    }
  });
}
