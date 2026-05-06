import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import type { BackendRequest, BackendResponse } from '@frontend-demo/shared';
import { BackendInvocationError } from '@frontend-demo/shared';

const client = new LambdaClient({});
const BACKEND_FUNCTION_NAME = process.env.BACKEND_FUNCTION_NAME!;

export async function invokeBackend<T>(request: BackendRequest): Promise<BackendResponse<T>> {
  const result = await client.send(
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
