import { Construct } from 'constructs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface BackendLambdaProps {
  honeycombApiKey: string;
}

export class BackendLambdaConstruct extends Construct {
  public readonly fn: NodejsFunction;
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: BackendLambdaProps) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: 'frontend-demo-table',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const adotLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'AdotLayer',
      'arn:aws:lambda:ap-southeast-2:901920570463:layer:aws-otel-nodejs-amd64-ver-1-30-2:1',
    );

    this.fn = new NodejsFunction(this, 'Function', {
      functionName: 'frontend-demo-backend',
      entry: path.join(__dirname, '../../packages/backend/src/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      layers: [adotLayer],
      environment: {
        TABLE_NAME: this.table.tableName,
        HONEYCOMB_API_KEY: props.honeycombApiKey,
        SERVICE_NAME: 'backend',
        OTEL_SERVICE_NAME: 'backend',
        NODE_OPTIONS: '--enable-source-maps',
        DYNAMODB_ENDPOINT: '',
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-handler',
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'https://api.honeycomb.io/v1/traces',
        OTEL_EXPORTER_OTLP_HEADERS: `x-honeycomb-team=${props.honeycombApiKey}`,
        OTEL_NODE_DISABLED_INSTRUMENTATIONS: 'http',
      },
      timeout: cdk.Duration.seconds(10),
      bundling: {
        externalModules: ['@aws-sdk/*'],
        sourceMap: true,
        // esbuild defines exports via Object.defineProperty with configurable:false.
        // The ADOT layer wrapper needs to redefine `handler`, so re-export as a
        // plain object where properties are configurable by default.
        footer: ';module.exports = Object.assign({}, module.exports);',
      },
    });

    this.table.grantReadData(this.fn);
  }
}
