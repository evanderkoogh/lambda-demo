import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME ?? 'frontend-demo-table';
const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT ?? '';

// Only use a local endpoint when DYNAMODB_ENDPOINT is explicitly set.
// When not set, connect to real AWS DynamoDB.
const client = new DynamoDBClient(
  dynamoEndpoint
    ? { endpoint: dynamoEndpoint, region: 'us-east-1', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } }
    : { region: process.env.AWS_DEFAULT_REGION ?? 'ap-southeast-2' },
);
const docClient = DynamoDBDocumentClient.from(client);

async function createTable() {
  try {
    await client.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        AttributeDefinitions: [{ AttributeName: 'pk', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
    console.log(`Table "${TABLE_NAME}" created`);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ResourceInUseException') {
      console.log(`Table "${TABLE_NAME}" already exists`);
    } else {
      throw err;
    }
  }
}

async function seedItems() {
  const items = [
    { pk: 'item-001', name: 'Widget Alpha', category: 'widgets', price: 9.99, stock: 100 },
    { pk: 'item-002', name: 'Widget Beta', category: 'widgets', price: 14.99, stock: 50 },
    { pk: 'item-003', name: 'Gadget Gamma', category: 'gadgets', price: 49.99, stock: 25 },
    { pk: 'item-004', name: 'Gadget Delta', category: 'gadgets', price: 99.99, stock: 10 },
    { pk: 'item-005', name: 'Doohickey Epsilon', category: 'misc', price: 4.99, stock: 200 },
  ];

  for (const item of items) {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    console.log(`Seeded: ${item.pk}`);
  }
}

async function main() {
  await createTable();
  await seedItems();
  console.log('Seed complete');
}

main().catch((err) => { console.error(err); process.exit(1); });
