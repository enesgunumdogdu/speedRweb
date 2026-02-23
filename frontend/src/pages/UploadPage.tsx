import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { uploadVideo, createAnalysis } from "../api/videoApi";

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [referenceLengthCm, setReferenceLengthCm] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"uploading" | "analyzing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);
    setUploadPhase("uploading");

    try {
      const uploadRes = await uploadVideo(file, (percent) => {
        setUploadProgress(percent);
      });
      setUploadPhase("analyzing");
      const refLength = referenceLengthCm
        ? parseFloat(referenceLengthCm)
        : undefined;
      const analysisRes = await createAnalysis(uploadRes.videoId, refLength);
      navigate(`/result/${analysisRes.analysisId}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setError(message);
    } finally {
      setUploading(false);
      setUploadPhase(null);
      setUploadProgress(0);
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
          <div className="upload-progress mb-2">
            <div className="upload-progress-header">
              <span className="upload-progress-label">Uploading...</span>
              <span className="upload-progress-percent">{uploadProgress}%</span>
            </div>
            <div className="upload-progress-track">
              <div
                className="upload-progress-bar"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {uploading && uploadPhase === "analyzing" && (
          <div className="upload-progress mb-2">
            <div className="upload-progress-header">
              <span className="upload-progress-label">Starting analysis...</span>
            </div>
            <div className="upload-progress-track">
              <div className="upload-progress-bar indeterminate" />
            </div>
          </div>
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
              : "Starting analysis..."
            : "Upload & Analyze"}
        </button>
      </form>
    </div>
  );
}

export default UploadPage;
