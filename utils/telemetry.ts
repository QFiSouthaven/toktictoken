import { 
  WebTracerProvider, 
  SimpleSpanProcessor, 
  ConsoleSpanExporter 
} from '@opentelemetry/sdk-trace-web';
// import { Resource } from '@opentelemetry/resources';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { trace, Span } from '@opentelemetry/api';

// 1. Initialize the Provider
// Note: We use the default resource to avoid import issues where Resource is treated as a type.
// This will result in a default service name (e.g. 'unknown_service') which is acceptable for local debugging.
const provider = new WebTracerProvider();

// 2. Add Exporter (Console for local debugging, easy to swap for OTLP)
// In a real production build, we would check process.env for OTLP endpoints.
// Cast to any to bypass potential type mismatch in environment where addSpanProcessor is missing from type definition
(provider as any).addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

// 3. Register the provider globally
// ZoneContextManager is critical for async/await context propagation in React/JS
provider.register({
  contextManager: new ZoneContextManager(),
});

// 4. Export the Tracer
export const tracer = trace.getTracer('swarm-orchestrator');

/**
 * Helper to wrap async functions in spans automatically.
 */
export const traceAsync = async <T>(
  spanName: string, 
  attributes: Record<string, any>, 
  fn: (span: Span) => Promise<T>
): Promise<T> => {
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      span.setAttributes(attributes);
      const result = await fn(span);
      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // 2 = ERROR
      throw error;
    } finally {
      span.end();
    }
  });
};