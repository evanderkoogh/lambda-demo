import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { BackendLambdaConstruct } from './backend-lambda.js';
import { AuthorizerLambdaConstruct } from './authorizer-lambda.js';
import { MiddlewareLambdaConstruct } from './middleware-lambda.js';

export class FrontendDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- Backend Lambda + DynamoDB ---
    const backend = new BackendLambdaConstruct(this, 'Backend');

    // --- Authorizer Lambda ---
    const jwtSecret = process.env.JWT_SECRET ?? 'changeme-set-in-env';
    const authorizer = new AuthorizerLambdaConstruct(this, 'Authorizer', {
      jwtSecret,
    });

    // --- Middleware Lambda ---
    const middleware = new MiddlewareLambdaConstruct(this, 'Middleware', {
      backendFn: backend.fn,
    });

    // --- API Gateway ---
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'frontend-demo-api',
      description: 'ANZ Frontend Demo API',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const lambdaAuthorizer = new apigateway.TokenAuthorizer(this, 'LambdaAuthorizer', {
      handler: authorizer.fn,
      identitySource: apigateway.IdentitySource.header('Authorization'),
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    const middlewareIntegration = new apigateway.LambdaIntegration(middleware.fn);

    // Route: /items (GET) + /items/{id} (GET)
    const items = api.root.addResource('items');
    items.addMethod('GET', middlewareIntegration, {
      authorizer: lambdaAuthorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    const item = items.addResource('{id}');
    item.addMethod('GET', middlewareIntegration, {
      authorizer: lambdaAuthorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: backend.table.tableName,
      description: 'DynamoDB Table Name',
    });
  }
}
