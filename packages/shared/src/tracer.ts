import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace, context, propagation, SpanStatusCode, SpanKind, type Tracer } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

let _provider: NodeTracerProvider | undefined;
let _adotInitialized = false;

export function initTracer(): Tracer {
  const serviceName = process.env.OTEL_SERVICE_NAME ?? process.env.SERVICE_NAME ?? 'unknown';

  // When running under the ADOT Lambda layer the OTel SDK is already initialised
  // by the wrapper before our handler runs. Register a filtered HttpInstrumentation
  // so Lambda-internal HTTP (runtime API, AWS SDK transport) is suppressed while
  // real outbound HTTP calls are still captured. ADOT's default http instrumentation
  // must be disabled via OTEL_NODE_DISABLED_INSTRUMENTATIONS=http.
  if (process.env.AWS_LAMBDA_EXEC_WRAPPER) {
    if (!_adotInitialized) {
      _adotInitialized = true;
      registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          ignoreOutgoingRequestHook: (options) => {
            const hostname =
              typeof options === 'string'
                ? new URL(options).hostname
                : (options.hostname ?? '');
            // Suppress Lambda runtime (127.0.0.1) and AWS service calls
            // (AWS SDK calls are already captured by AwsInstrumentation).
            return (
              hostname === '127.0.0.1' ||
              hostname === 'localhost' ||
              hostname.endsWith('.amazonaws.com')
            );
          },
          ignoreIncomingRequestHook: (req) =>
            // Suppress Lambda Runtime API paths
            req.url?.startsWith('/2018-06-01/runtime/') ?? false,
        }),
      ],
      });
    }
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

export { trace, context, propagation, SpanStatusCode, SpanKind };
