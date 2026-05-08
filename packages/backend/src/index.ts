import type { BackendRequest, BackendResponse } from '@frontend-demo/shared';
import { logger, NotFoundError, initTracer, propagation, context, trace, SpanStatusCode } from '@frontend-demo/shared';
import { getItem, queryItems, listItems } from './dynamo-client.js';

const log = logger.child({ lambda: 'backend' });
initTracer();

export async function handler(event: BackendRequest): Promise<BackendResponse> {
  log.info({ operation: event.operation, requesterId: event.requesterId }, 'Backend invoked');

  // Extract parent trace context propagated from middleware
  const parentContext = event.traceContext
    ? propagation.extract(context.active(), event.traceContext)
    : context.active();

  const span = trace.getActiveSpan();

  return context.with(parentContext, async () => {
    try {
      span?.setAttribute('backend.operation', event.operation);
      span?.setAttribute('user.id', event.requesterId);

      switch (event.operation) {
        case 'getItem': {
          const pk = event.params.pk as string;
          span?.setAttribute('dynamo.pk', pk);
          const item = await getItem(pk);
          if (!item) throw new NotFoundError(`Item ${pk}`);
          span?.setStatus({ code: SpanStatusCode.OK });
          return { success: true, data: item };
        }

        case 'queryItems': {
          const pk = event.params.pk as string;
          const limit = (event.params.limit as number) ?? 20;
          span?.setAttribute('dynamo.pk', pk);
          const items = await queryItems(pk, limit);
          span?.setStatus({ code: SpanStatusCode.OK });
          return { success: true, data: items };
        }

        case 'listItems': {
          const limit = (event.params.limit as number) ?? 20;
          const items = await listItems(limit);
          span?.setStatus({ code: SpanStatusCode.OK });
          return { success: true, data: items };
        }

        default:
          span?.setStatus({ code: SpanStatusCode.ERROR, message: 'Unknown operation' });
          return { success: false, error: `Unknown operation: ${(event as BackendRequest).operation}` };
      }
    } catch (err: unknown) {
      if (err instanceof NotFoundError) {
        span?.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        return { success: false, error: err.message };
      }
      log.error({ err }, 'Backend error');
      span?.setStatus({ code: SpanStatusCode.ERROR, message: 'Internal error' });
      return { success: false, error: 'Internal error' };
    }
  });
}
