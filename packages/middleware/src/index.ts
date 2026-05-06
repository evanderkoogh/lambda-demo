import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { BackendRequest } from '@frontend-demo/shared';
import { logger } from '@frontend-demo/shared';
import { invokeBackend } from './backend-client.js';

const log = logger.child({ lambda: 'middleware' });

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.userId as string;
  log.info({ path: event.path, method: event.httpMethod, userId }, 'Request received');

  try {
    // Route /items/{id} → getItem, /items → listItems
    const pathParts = event.path.replace(/^\//, '').split('/');
    const itemId = pathParts[1]; // present for /items/{id}

    const request: BackendRequest = itemId
      ? { operation: 'getItem', params: { pk: itemId }, requesterId: userId }
      : { operation: 'listItems', params: { limit: Number(event.queryStringParameters?.limit ?? 20) }, requesterId: userId };

    const response = await invokeBackend(request);

    if (!response.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: response.error }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response.data),
    };
  } catch (err) {
    log.error({ err }, 'Middleware error');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
