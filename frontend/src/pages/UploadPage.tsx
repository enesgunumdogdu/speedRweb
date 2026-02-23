import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { uploadVideo, createAnalysis, getAnalysis } from "../api/videoApi";
import ProgressBar from "../components/ProgressBar";

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [referenceLengthCm, setReferenceLengthCm] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"uploading" | "analyzing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const pollAnalysisProgress = useCallback(
    (analysisId: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const poll = async () => {
          try {
            const data = await getAnalysis(analysisId);
            setAnalysisProgress(data.progressPercent ?? 0);

            if (data.status === "COMPLETED" || data.status === "FAILED") {
              resolve();
              navigate(`/result/${analysisId}`);
            } else {
              setTimeout(poll, 1000);
            }
          } catch (err) {
            reject(err);
          }
        };
        setTimeout(poll, 500);
      });
    },
    [navigate]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);
    setAnalysisProgress(0);
    setUploadPhase("uploading");

    try {
      const uploadRes = await uploadVideo(file, (percent) => {
        setUploadProgress(percent);
      });
      setUploadPhase("analyzing");
      setAnalysisProgress(0);
      const refLength = referenceLengthCm
        ? parseFloat(referenceLengthCm)
        : undefined;
      await createAnalysis(uploadRes.videoId, refLength).then((res) =>
        pollAnalysisProgress(res.analysisId)
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setError(message);
    } finally {
      setUploading(false);
      setUploadPhase(null);
      setUploadProgress(0);
      setAnalysisProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith("video/")) {
      setFile(dropped);
    }
  };

  const analysisLabel =
    analysisProgress > 0
      ? `Analyzing... ${analysisProgress}%`
      : "Starting analysis...";

  useEffect(() => {
    if (!uploading) {
      document.title = "Upload — SpeedR";
      return;
    }
    if (uploadPhase === "uploading") {
      document.title = `Uploading... ${uploadProgress}% — SpeedR`;
    } else if (uploadPhase === "analyzing") {
      document.title = analysisProgress > 0
        ? `Analyzing... ${analysisProgress}% — SpeedR`
        : "Analyzing... — SpeedR";
    }
  }, [uploading, uploadPhase, uploadProgress, analysisProgress]);

  useEffect(() => {
    return () => { document.title = "SpeedR"; };
  }, []);

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <h1>Upload Video</h1>
      <p className="mb-3">
        Upload an ice hockey video to measure stick swing speed.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="card mb-3">
          {/* File drop zone */}
          <div
            className={`file-drop${dragActive ? " active" : ""}${file ? " active" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div>
                <p className="file-drop-label">
                  <strong>{file.name}</strong>
                </p>
                <p className="file-info">{formatFileSize(file.size)}</p>
              </div>
            ) : (
              <div>
                <p className="file-drop-label">
                  <strong>Click to browse</strong> or drag & drop
                </p>
                <p className="file-info">MP4, MOV, AVI, WebM</p>
              </div>
            )}
          </div>

          {/* Reference length */}
          <div className="mt-3">
            <label htmlFor="reference-length">
              Reference Length (cm) <span className="optional">- optional</span>
            </label>
            <input
              id="reference-length"
              type="number"
              min="1"
              step="0.1"
              placeholder="e.g. 150 (stick length)"
              value={referenceLengthCm}
              onChange={(e) => setReferenceLengthCm(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="error-text mb-2">{error}</p>
        )}

        {uploading && uploadPhase === "uploading" && (
          <ProgressBar label="Uploading..." percent={uploadProgress} />
        )}

        {uploading && uploadPhase === "analyzing" && (
          <ProgressBar
            label={analysisLabel}
            percent={analysisProgress}
            indeterminate={analysisProgress === 0}
          />
        )}

        <button
          type="submit"
          disabled={!file || uploading}
          className="btn btn-primary"
          style={{ width: "100%" }}
        >
          {uploading
            ? uploadPhase === "uploading"
              ? `Uploading... ${uploadProgress}%`
              : analysisLabel
            : "Upload & Analyze"}
        </button>
      </form>
    </div>
  );
}

export default UploadPage;
