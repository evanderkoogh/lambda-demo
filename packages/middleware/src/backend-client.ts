import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import type { BackendRequest, BackendResponse } from '@frontend-demo/shared';
import { BackendInvocationError } from '@frontend-demo/shared';

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

  const result = await getLambdaClient().send(
    new InvokeCommand({
      FunctionName: BACKEND_FUNCTION_NAME,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify(request)),
    }),
  );

  if (result.FunctionError) {
    throw new BackendInvocationError(`Backend Lambda error: ${result.FunctionError}`);
  }

  const payload = JSON.parse(Buffer.from(result.Payload!).toString()) as BackendResponse<T>;
  return payload;
}
