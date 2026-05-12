import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { BackendRequest } from '@frontend-demo/shared';
import { logger, initTracer, trace, SpanStatusCode } from '@frontend-demo/shared';
import { invokeBackend } from './backend-client.js';

const log = logger.child({ lambda: 'middleware' });
initTracer();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.userId as string;
  log.info({ path: event.path, method: event.httpMethod, userId }, 'Request received');

  // ADOT's Lambda instrumentation already extracts W3C traceparent from event.headers
  // and makes this invocation a child of the incoming trace — no manual context.with needed.
  const span = trace.getActiveSpan();

  try {
    // Route /items/{id} → getItem, /items → listItems
    const pathParts = event.path.replace(/^\//, '').split('/');
    const itemId = pathParts[1]; // present for /items/{id}

    span?.setAttribute('http.request.method', event.httpMethod);
    span?.setAttribute('url.path', event.path);
    span?.setAttribute('http.route', itemId ? '/items/{id}' : '/items');
    span?.setAttribute('user.id', userId);
    if (itemId) span?.setAttribute('item.id', itemId);

    // AWS SDK instrumentation injects the active client span's traceparent into
    // ClientContext.Custom when invoking the backend Lambda, so ADOT in the backend
    // will parent correctly off the invoke client span — no manual injection needed.
    const request: BackendRequest = itemId
      ? { operation: 'getItem', params: { pk: itemId }, requesterId: userId }
      : { operation: 'listItems', params: { limit: Number(event.queryStringParameters?.limit ?? 20) }, requesterId: userId };

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
}
