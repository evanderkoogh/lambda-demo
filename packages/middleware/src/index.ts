import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { BackendRequest } from '@frontend-demo/shared';
import { logger, initTracer, flushTracer, propagation, context, SpanStatusCode } from '@frontend-demo/shared';
import { invokeBackend } from './backend-client.js';

const log = logger.child({ lambda: 'middleware' });
const tracer = initTracer();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.userId as string;
  log.info({ path: event.path, method: event.httpMethod, userId }, 'Request received');

  return tracer.startActiveSpan('middleware.handler', async (span) => {
    try {
      span.setAttribute('http.method', event.httpMethod);
      span.setAttribute('http.path', event.path);
      span.setAttribute('user.id', userId);

      // Inject W3C traceparent into BackendRequest for trace propagation
      const traceContext: Record<string, string> = {};
      propagation.inject(context.active(), traceContext);

      // Route /items/{id} → getItem, /items → listItems
      const pathParts = event.path.replace(/^\//, '').split('/');
      const itemId = pathParts[1]; // present for /items/{id}

      const request: BackendRequest = itemId
        ? { operation: 'getItem', params: { pk: itemId }, requesterId: userId, traceContext }
        : { operation: 'listItems', params: { limit: Number(event.queryStringParameters?.limit ?? 20) }, requesterId: userId, traceContext };

      const response = await invokeBackend(request);

      if (!response.success) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: response.error });
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: response.error }),
        };
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response.data),
      };
    } catch (err) {
      log.error({ err }, 'Middleware error');
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Internal server error' });
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    } finally {
      span.end();
      await flushTracer();
    }
  });
}
