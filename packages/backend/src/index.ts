import type { BackendRequest, BackendResponse } from '@frontend-demo/shared';
import { logger, NotFoundError } from '@frontend-demo/shared';
import { getItem, queryItems, listItems } from './dynamo-client.js';

const log = logger.child({ lambda: 'backend' });

export async function handler(event: BackendRequest): Promise<BackendResponse> {
  log.info({ operation: event.operation, requesterId: event.requesterId }, 'Backend invoked');

  try {
    switch (event.operation) {
      case 'getItem': {
        const pk = event.params.pk as string;
        const item = await getItem(pk);
        if (!item) throw new NotFoundError(`Item ${pk}`);
        return { success: true, data: item };
      }

      case 'queryItems': {
        const pk = event.params.pk as string;
        const limit = (event.params.limit as number) ?? 20;
        const items = await queryItems(pk, limit);
        return { success: true, data: items };
      }

      case 'listItems': {
        const limit = (event.params.limit as number) ?? 20;
        const items = await listItems(limit);
        return { success: true, data: items };
      }

      default:
        return { success: false, error: `Unknown operation: ${(event as BackendRequest).operation}` };
    }
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return { success: false, error: err.message };
    }
    log.error({ err }, 'Backend error');
    return { success: false, error: 'Internal error' };
  }
}
