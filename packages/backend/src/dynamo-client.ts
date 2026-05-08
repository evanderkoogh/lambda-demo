import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Lazy-initialized so the client is created after OTel instrumentation is set up,
// ensuring the AWS SDK middleware injection from AwsInstrumentation takes effect.
let _docClient: DynamoDBDocumentClient | undefined;

function getDocClient(): DynamoDBDocumentClient {
  if (_docClient) return _docClient;
  const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT || '';
  const isLocal = process.env.AWS_SAM_LOCAL === 'true' || dynamoEndpoint !== '';
  const ddbClient = new DynamoDBClient(
    isLocal
      ? { endpoint: dynamoEndpoint || 'http://localhost:8000', region: 'us-east-1' }
      : {},
  );
  _docClient = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return _docClient;
}

export const TABLE_NAME = process.env.TABLE_NAME!;

export async function getItem(pk: string): Promise<Record<string, unknown> | undefined> {
  const result = await getDocClient().send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk },
    }),
  );
  return result.Item as Record<string, unknown> | undefined;
}

export async function queryItems(
  pk: string,
  limit = 20,
): Promise<Record<string, unknown>[]> {
  const result = await getDocClient().send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
      Limit: limit,
    }),
  );
  return (result.Items ?? []) as Record<string, unknown>[];
}

export async function listItems(limit = 20): Promise<Record<string, unknown>[]> {
  const result = await getDocClient().send(
    new ScanCommand({
      TableName: TABLE_NAME,
      Limit: limit,
    }),
  );
  return (result.Items ?? []) as Record<string, unknown>[];
}
