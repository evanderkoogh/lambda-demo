import type { APIGatewayAuthorizerResult } from '@frontend-demo/shared';

export function buildPolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, string>,
): APIGatewayAuthorizerResult {
  // Wildcard over all methods/routes on this API so the cached policy
  // covers every endpoint, not just the one that triggered the authorizer.
  const apiWildcard = resource.replace(/\/[^/]+\/[^/]+$/, '/*/*');

  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: apiWildcard,
        },
      ],
    },
    context,
  };
}
