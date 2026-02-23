import api from "./axios";

export interface VideoUploadResponse {
  videoId: string;
  originalFilename: string;
  fileSizeBytes: number;
}

export interface AnalysisResponse {
  analysisId: string;
  videoId: string;
  sportType: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  speedKmh: number | null;
  speedMph: number | null;
  confidence: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export async function uploadVideo(file: File): Promise<VideoUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post<VideoUploadResponse>("/videos/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function createAnalysis(
  videoId: string,
  referenceLengthCm?: number
): Promise<AnalysisResponse> {
  const res = await api.post<AnalysisResponse>("/analysis", {
    videoId,
    referenceLengthCm: referenceLengthCm ?? null,
  });
  return res.data;
}

export async function getAnalysis(
  analysisId: string
): Promise<AnalysisResponse> {
  const res = await api.get<AnalysisResponse>(`/analysis/${analysisId}`);
  return res.data;
}
