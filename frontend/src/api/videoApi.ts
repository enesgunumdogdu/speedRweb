import api from "./axios";

export interface VideoUploadResponse {
  videoId: string;
  originalFilename: string;
  fileSizeBytes: number;
}

export interface PoseLandmarkFrame {
  lm: Record<string, [number, number]>;
}

export interface PoseLandmarks {
  step: number;
  frames: (PoseLandmarkFrame | null)[];
}

export interface FrameData {
  fps: number;
  frameSpeeds: number[];
  poseLandmarks?: PoseLandmarks | null;
}

export interface AnalysisResponse {
  analysisId: string;
  videoId: string;
  sportType: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  progressPercent: number;
  speedKmh: number | null;
  speedMph: number | null;
  confidence: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  frameData: FrameData | null;
}

export interface AnalysisListItem {
  analysisId: string;
  videoId: string;
  videoFilename: string;
  sportType: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  speedKmh: number | null;
  speedMph: number | null;
  confidence: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export async function uploadVideo(
  file: File,
  onUploadProgress?: (percent: number) => void
): Promise<VideoUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post<VideoUploadResponse>("/videos/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onUploadProgress
      ? (e) => {
          const percent = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
          onUploadProgress(percent);
        }
      : undefined,
  });
  return res.data;
}

export async function createAnalysis(
  videoId: string,
  referenceLengthCm?: number,
  playerHeightCm?: number
): Promise<AnalysisResponse> {
  const res = await api.post<AnalysisResponse>("/analysis", {
    videoId,
    referenceLengthCm: referenceLengthCm ?? null,
    playerHeightCm: playerHeightCm ?? null,
  });
  return res.data;
}

export async function getAnalysis(
  analysisId: string
): Promise<AnalysisResponse> {
  const res = await api.get<AnalysisResponse>(`/analysis/${analysisId}`);
  return res.data;
}

export function getVideoStreamUrl(videoId: string): string {
  const token = localStorage.getItem("token");
  const base = `${api.defaults.baseURL}/videos/${videoId}/stream`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export async function getAnalysisHistory(
  page: number = 0,
  size: number = 10
): Promise<PagedResponse<AnalysisListItem>> {
  const res = await api.get<PagedResponse<AnalysisListItem>>("/analysis", {
    params: { page, size },
  });
  return res.data;
}
