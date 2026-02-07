/**
 * @ereo/trace - Build Pipeline Instrumentor (Layer 10)
 *
 * Span per build stage.
 * Records: stage name, files processed, duration.
 */

import type { Span, Tracer } from '../types';

/**
 * Trace a build stage.
 */
export function traceBuildStage<T>(
  parentSpan: Span,
  stageName: string,
  stageFn: () => T | Promise<T>,
  attrs?: { filesCount?: number },
): T | Promise<T> {
  const span = parentSpan.child(`build:${stageName}`, 'build');
  span.setAttribute('build.stage', stageName);
  if (attrs?.filesCount) span.setAttribute('build.files_count', attrs.filesCount);

  try {
    const result = stageFn();
    if (result instanceof Promise) {
      return result
        .then((v) => {
          span.end();
          return v;
        })
        .catch((err) => {
          span.error(err);
          span.end();
          throw err;
        });
    }
    span.end();
    return result;
  } catch (err) {
    span.error(err);
    span.end();
    throw err;
  }
}

/**
 * Create a build tracer that wraps an entire build process.
 */
export function traceBuild(
  tracer: Tracer,
  buildName: string = 'production build',
): Span {
  return tracer.startTrace(buildName, 'build', { origin: 'server' });
}
