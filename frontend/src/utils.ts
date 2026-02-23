const KMH_TO_MPH = 0.621371;

export function toMph(kmh: number): number {
  return kmh * KMH_TO_MPH;
}

export function extractApiError(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "response" in err) {
    const resp = (err as { response?: { data?: { error?: string } } }).response;
    if (resp?.data?.error) return resp.data.error;
  }
  return fallback;
}

export interface FrameStats {
  avg: number;
  duration: number;
  totalFrames: number;
  fps: number;
  peakTime: number;
}

export function computeFrameStats(frameSpeeds: number[], fps: number, peakFrameIdx?: number): FrameStats {
  const nonZero = frameSpeeds.filter((s) => s > 0);
  const avg = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
  const totalFrames = frameSpeeds.length;
  const duration = totalFrames / fps;
  const peakTime = (peakFrameIdx ?? 0) / fps;
  return { avg, duration, totalFrames, fps, peakTime };
}
