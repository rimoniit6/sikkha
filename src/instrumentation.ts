/**
 * Next.js Instrumentation Hook
 *
 * This file runs during server startup in both Edge and Node runtimes.
 * The `process.env.NEXT_RUNTIME !== 'nodejs'` guard ensures that
 * Node.js-specific APIs (process.on, process.exit, process handlers)
 * are never accessed in Edge Runtime — they are extracted to
 * `@/lib/node-instrumentation.ts` which is only imported dynamically
 * within the guarded block.
 */

export async function register() {
  // Edge Runtime guard — return early before importing any Node.js code
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Delegate all Node.js initialization to the Node-only module
  // This keeps process.on / process.exit out of the Edge module graph
  const { initializeNodeRuntime } = await import('@/lib/node-instrumentation')
  await initializeNodeRuntime()
}
