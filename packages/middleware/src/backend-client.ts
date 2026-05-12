import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import type { BackendRequest, BackendResponse } from '@frontend-demo/shared';
import { BackendInvocationError, context, propagation, trace, SpanKind, SpanStatusCode } from '@frontend-demo/shared';

const IS_LOCAL = process.env.AWS_SAM_LOCAL === 'true';
const BACKEND_FUNCTION_NAME = process.env.BACKEND_FUNCTION_NAME!;

// Lazy-initialized so the client is created after OTel instrumentation is set up.
let _lambdaClient: LambdaClient | undefined;
function getLambdaClient(): LambdaClient {
  _lambdaClient ??= new LambdaClient({});
  return _lambdaClient;
}

export async function invokeBackend<T>(request: BackendRequest): Promise<BackendResponse<T>> {
  // In SAM local there is no Lambda invoke endpoint, so call the handler directly.
  if (IS_LOCAL) {
    const { handler } = await import('../../backend/src/index.js');
    return handler(request) as Promise<BackendResponse<T>>;
  }

  // Create an explicit client span before injecting traceparent into the payload.
  // The AWS SDK auto-instrumentation creates its span only when send() is called,
  // which is too late — the payload is already built by then. By injecting from
  // within this span's context, the backend server span parents off this span
  // rather than the middleware server span.
  const span = trace.getTracer('middleware').startSpan('invoke backend', {
    kind: SpanKind.CLIENT,
    attributes: {
      'faas.invoked_name': BACKEND_FUNCTION_NAME,
      'faas.invoked_provider': 'aws',
    },
  });
  const ctx = trace.setSpan(context.active(), span);

  const headers: Record<string, string> = {};
  propagation.inject(ctx, headers);

  try {
    const result = await context.with(ctx, () =>
      getLambdaClient().send(
        new InvokeCommand({
          FunctionName: BACKEND_FUNCTION_NAME,
          InvocationType: 'RequestResponse',
          Payload: Buffer.from(JSON.stringify({ ...request, headers })),
        }),
      ),
    );

    span.end();

    if (result.FunctionError) {
      throw new BackendInvocationError(`Backend Lambda error: ${result.FunctionError}`);
    }

    return JSON.parse(Buffer.from(result.Payload!).toString()) as BackendResponse<T>;
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();
    throw err;
  }
}
