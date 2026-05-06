import * as cdk from 'aws-cdk-lib';
import { FrontendDemoStack } from '../lib/frontend-demo-stack.js';

const app = new cdk.App();

new FrontendDemoStack(app, 'FrontendDemoStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-southeast-2',
  },
  description: 'ANZ Frontend Demo — API Gateway + Lambda + DynamoDB',
});
