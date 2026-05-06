import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const isLocal = process.env.AWS_SAM_LOCAL === 'true' || process.env.DYNAMODB_ENDPOINT != null;

const ddbClient = new DynamoDBClient(
  isLocal
    ? { endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000', region: 'us-east-1' }
    : {},
);

export const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_NAME = process.env.TABLE_NAME!;

export async function getItem(pk: string): Promise<Record<string, unknown> | undefined> {
  const result = await docClient.send(
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
  const result = await docClient.send(
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
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      Limit: limit,
    }),
  );
  return (result.Items ?? []) as Record<string, unknown>[];
}
