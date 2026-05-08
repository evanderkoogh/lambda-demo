import { Construct } from 'constructs';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AuthorizerLambdaProps {
  jwtSecret: string;
  honeycombApiKey: string;
}

export class AuthorizerLambdaConstruct extends Construct {
  public readonly fn: NodejsFunction;

  constructor(scope: Construct, id: string, props: AuthorizerLambdaProps) {
    super(scope, id);

    const adotLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'AdotLayer',
      'arn:aws:lambda:ap-southeast-2:901920570463:layer:aws-otel-nodejs-amd64-ver-1-30-2:1',
    );

    this.fn = new NodejsFunction(this, 'Function', {
      functionName: 'frontend-demo-authorizer',
      entry: path.join(__dirname, '../../packages/authorizer/src/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      layers: [adotLayer],
      environment: {
        JWT_SECRET: props.jwtSecret,
        HONEYCOMB_API_KEY: props.honeycombApiKey,
        SERVICE_NAME: 'authorizer',
        OTEL_SERVICE_NAME: 'authorizer',
        NODE_OPTIONS: '--enable-source-maps',
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-handler',
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'https://api.honeycomb.io/v1/traces',
        OTEL_EXPORTER_OTLP_HEADERS: `x-honeycomb-team=${props.honeycombApiKey}`,
        // Disable ADOT's unfiltered HttpInstrumentation; our tracer.ts registers
        // a filtered version that suppresses Lambda-internal transport spans.
        OTEL_NODE_DISABLED_INSTRUMENTATIONS: 'http',
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
        sourceMap: true,
        footer: ';module.exports = Object.assign({}, module.exports);',
      },
    });
  }
}
