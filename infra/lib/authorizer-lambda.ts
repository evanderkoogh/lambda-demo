import { Construct } from 'constructs';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AuthorizerLambdaProps {
  jwtSecret: string;
}

export class AuthorizerLambdaConstruct extends Construct {
  public readonly fn: NodejsFunction;

  constructor(scope: Construct, id: string, props: AuthorizerLambdaProps) {
    super(scope, id);

    this.fn = new NodejsFunction(this, 'Function', {
      functionName: 'frontend-demo-authorizer',
      entry: path.join(__dirname, '../../packages/authorizer/src/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        JWT_SECRET: props.jwtSecret,
        SERVICE_NAME: 'authorizer',
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
        sourceMap: true,
      },
    });
  }
}
