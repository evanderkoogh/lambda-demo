import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace, context, propagation, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

let _provider: NodeTracerProvider | undefined;

export function initTracer(): Tracer {
  const serviceName = process.env.OTEL_SERVICE_NAME ?? process.env.SERVICE_NAME ?? 'unknown';

  // When running under the ADOT Lambda layer the OTel SDK is already initialised
  // by the wrapper before our handler runs — just get a tracer from it.
  if (process.env.AWS_LAMBDA_EXEC_WRAPPER) {
    return trace.getTracer(serviceName);
  }

  if (_provider) return trace.getTracer(serviceName);

  const exporter = new OTLPTraceExporter({
    url: 'https://api.honeycomb.io/v1/traces',
    headers: {
      'x-honeycomb-team': process.env.HONEYCOMB_API_KEY ?? '',
      ...(process.env.HONEYCOMB_DATASET ? { 'x-honeycomb-dataset': process.env.HONEYCOMB_DATASET } : {}),
    },
  });

  _provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  _provider.register();

  registerInstrumentations({
    instrumentations: [
      new AwsInstrumentation(),
      new HttpInstrumentation(),
      new UndiciInstrumentation(),
    ],
  });

  return trace.getTracer(serviceName);
}

export async function flushTracer(): Promise<void> {
  // ADOT Lambda layer handles flushing after the handler returns.
  if (process.env.AWS_LAMBDA_EXEC_WRAPPER) return;

  // Best-effort flush with a short timeout so Lambda doesn't stall locally.
  await Promise.race([
    _provider?.forceFlush() ?? Promise.resolve(),
    new Promise<void>((resolve) => setTimeout(resolve, 500)),
  ]);
}

export { trace, context, propagation, SpanStatusCode };
