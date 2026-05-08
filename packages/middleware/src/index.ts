import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { BackendRequest } from '@frontend-demo/shared';
import { logger, initTracer, propagation, context, trace, SpanStatusCode } from '@frontend-demo/shared';
import { invokeBackend } from './backend-client.js';

const log = logger.child({ lambda: 'middleware' });
initTracer();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.userId as string;
  log.info({ path: event.path, method: event.httpMethod, userId }, 'Request received');

  // Extract incoming W3C traceparent so spans link back to the caller's trace
  const incomingContext = propagation.extract(context.active(), event.headers ?? {});
  const span = trace.getActiveSpan();

  return context.with(incomingContext, async () => {
    try {
      // Route /items/{id} → getItem, /items → listItems
      const pathParts = event.path.replace(/^\//, '').split('/');
      const itemId = pathParts[1]; // present for /items/{id}

      span?.setAttribute('http.request.method', event.httpMethod);
      span?.setAttribute('url.path', event.path);
      span?.setAttribute('app.route', itemId ? '/items/{id}' : '/items');
      span?.setAttribute('user.id', userId);
      if (itemId) span?.setAttribute('item.id', itemId);

      // Inject W3C traceparent into BackendRequest for trace propagation
      const traceContext: Record<string, string> = {};
      propagation.inject(context.active(), traceContext);

      const request: BackendRequest = itemId
        ? { operation: 'getItem', params: { pk: itemId }, requesterId: userId, traceContext }
        : { operation: 'listItems', params: { limit: Number(event.queryStringParameters?.limit ?? 20) }, requesterId: userId, traceContext };

      const response = await invokeBackend(request);

      if (!response.success) {
        span?.setAttribute('http.response.status_code', 400);
        span?.setStatus({ code: SpanStatusCode.ERROR, message: response.error });
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: response.error }),
        };
      }

      span?.setAttribute('http.response.status_code', 200);
      span?.setStatus({ code: SpanStatusCode.OK });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response.data),
      };
    } catch (err) {
      log.error({ err }, 'Middleware error');
      span?.setAttribute('http.response.status_code', 500);
      span?.setStatus({ code: SpanStatusCode.ERROR, message: 'Internal server error' });
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  });
}
