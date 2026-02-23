import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { uploadVideo, createAnalysis } from "../api/videoApi";

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [referenceLengthCm, setReferenceLengthCm] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const uploadRes = await uploadVideo(file);
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
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem" }}>
      <h1>Upload Video</h1>
      <p style={{ color: "#666" }}>
        Upload an ice hockey video to measure stick speed.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="video-file"
            style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}
          >
            Video File
          </label>
          <input
            id="video-file"
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ display: "block" }}
          />
          {file && (
            <p style={{ fontSize: "0.875rem", color: "#888", marginTop: "0.25rem" }}>
              {file.name} ({formatFileSize(file.size)})
            </p>
          )}
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="reference-length"
            style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}
          >
            Reference Length (cm){" "}
            <span style={{ fontWeight: 400, color: "#888" }}>— optional</span>
          </label>
          <input
            id="reference-length"
            type="number"
            min="1"
            step="0.1"
            placeholder="e.g. 150 (stick length)"
            value={referenceLengthCm}
            onChange={(e) => setReferenceLengthCm(e.target.value)}
            style={{ padding: "0.5rem", width: "100%", boxSizing: "border-box" }}
          />
        </div>

        {error && (
          <p style={{ color: "#d32f2f", marginBottom: "1rem" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={!file || uploading}
          style={{
            padding: "0.75rem 2rem",
            fontSize: "1rem",
            backgroundColor: !file || uploading ? "#ccc" : "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: !file || uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Uploading & Analyzing..." : "Upload & Analyze"}
        </button>
      </form>
    </div>
  );
}

export default UploadPage;
