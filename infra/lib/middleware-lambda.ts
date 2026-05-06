import { Construct } from 'constructs';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface MiddlewareLambdaProps {
  backendFn: lambda.IFunction;
}

export class MiddlewareLambdaConstruct extends Construct {
  public readonly fn: NodejsFunction;

  constructor(scope: Construct, id: string, props: MiddlewareLambdaProps) {
    super(scope, id);

    this.fn = new NodejsFunction(this, 'Function', {
      functionName: 'frontend-demo-middleware',
      entry: path.join(__dirname, '../../packages/middleware/src/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        BACKEND_FUNCTION_NAME: props.backendFn.functionName,
        SERVICE_NAME: 'middleware',
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
        sourceMap: true,
      },
    });

    props.backendFn.grantInvoke(this.fn);
  }
}
