import type { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult } from '@frontend-demo/shared';
import { logger, initTracer, trace, SpanStatusCode } from '@frontend-demo/shared';
import { validateToken } from './token-validator.js';
import { buildPolicy } from './policy-builder.js';

const log = logger.child({ lambda: 'authorizer' });
initTracer();

export async function handler(
  event: APIGatewayRequestAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> {
  // ADOT's Lambda instrumentation already extracts W3C traceparent from event.headers
  // and parents this span correctly — no manual context extraction needed.
  const span = trace.getActiveSpan();

  const authHeader = event.headers?.Authorization ?? event.headers?.authorization ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    log.warn('No token provided');
    span?.setStatus({ code: SpanStatusCode.ERROR, message: 'No token provided' });
    throw new Error('Unauthorized');
  }

  try {
    const authContext = validateToken(token);
    log.info({ userId: authContext.userId }, 'Token validated successfully');
    span?.setAttribute('user.id', authContext.userId);
    span?.setAttribute('user.email', authContext.email);
    span?.setStatus({ code: SpanStatusCode.OK });

    return buildPolicy(authContext.userId, 'Allow', event.methodArn, {
      userId: authContext.userId,
      email: authContext.email,
    });
  } catch (err) {
    log.warn({ err }, 'Token validation failed');
    span?.setStatus({ code: SpanStatusCode.ERROR, message: 'Token validation failed' });
    throw new Error('Unauthorized');
  }
}
