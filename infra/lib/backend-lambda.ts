import { Construct } from 'constructs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BackendLambdaConstruct extends Construct {
  public readonly fn: NodejsFunction;
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: 'frontend-demo-table',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.fn = new NodejsFunction(this, 'Function', {
      functionName: 'frontend-demo-backend',
      entry: path.join(__dirname, '../../packages/backend/src/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        TABLE_NAME: this.table.tableName,
        SERVICE_NAME: 'backend',
        NODE_OPTIONS: '--enable-source-maps',
        DYNAMODB_ENDPOINT: '',
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
        sourceMap: true,
      },
    });

    this.table.grantReadData(this.fn);
  }
}
