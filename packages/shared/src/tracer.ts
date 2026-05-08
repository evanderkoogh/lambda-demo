import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace, context, propagation, SpanStatusCode, type Tracer } from '@opentelemetry/api';

let _provider: NodeTracerProvider | undefined;

export function initTracer(): Tracer {
  const serviceName = process.env.SERVICE_NAME ?? 'unknown';
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

  return trace.getTracer(serviceName);
}

export async function flushTracer(): Promise<void> {
  // Best-effort flush with a short timeout so Lambda doesn't stall locally
  await Promise.race([
    _provider?.forceFlush() ?? Promise.resolve(),
    new Promise<void>((resolve) => setTimeout(resolve, 500)),
  ]);
}

export { trace, context, propagation, SpanStatusCode };
