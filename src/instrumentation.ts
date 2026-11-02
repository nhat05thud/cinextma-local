export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { serverEnv } = await import("@/server/env");
  if (!serverEnv.workerEnabled) return;
  const { startWorker } = await import("@/server/media/worker");
  startWorker();
}
