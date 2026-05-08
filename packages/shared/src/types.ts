import type { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent } from 'aws-lambda';

export type { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent };

export interface AuthorizerContext {
  userId: string;
  email: string;
}

export interface MiddlewareRequest {
  path: string;
  method: string;
  queryParams: Record<string, string>;
  body: unknown;
  authContext: AuthorizerContext;
}

export interface BackendRequest {
  operation: 'getItem' | 'queryItems' | 'listItems';
  params: Record<string, unknown>;
  requesterId: string;
  traceContext?: Record<string, string>;
}

export interface BackendResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
