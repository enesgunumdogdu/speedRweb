import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAnalysis, getVideoStreamUrl, type AnalysisResponse } from "../api/videoApi";
import SpeedOverlay from "../components/SpeedOverlay";

function ResultPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getAnalysis(analysisId);
        if (cancelled) return;
        setAnalysis(data);

        if (data.status === "PENDING" || data.status === "PROCESSING") {
          setTimeout(poll, 1500);
        }
      } catch {
        if (!cancelled) setError("Failed to fetch analysis status.");
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  if (error) {
    return (
      <div className="page text-center mt-4">
        <p className="error-text mb-2">{error}</p>
        <Link to="/upload" className="btn btn-ghost">Try again</Link>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="page text-center mt-4">
        <div className="spinner" />
        <p className="mt-2" style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  const isPending =
    analysis.status === "PENDING" || analysis.status === "PROCESSING";

  const hasFrameData = analysis.frameData != null && analysis.frameData.frameSpeeds.length > 0;

  return (
    <div className="page">
      {isPending && (
        <div className="card text-center" style={{ padding: "3rem 2rem" }}>
          <div className="spinner mb-3" />
          <h2>Analyzing video...</h2>
          <p style={{ color: "var(--text-muted)" }}>
            Status: {analysis.status}
          </p>
        </div>
      )}

      {analysis.status === "COMPLETED" && (
        <>
          {hasFrameData && (
            <SpeedOverlay
              videoUrl={getVideoStreamUrl(analysis.videoId)}
              frameData={analysis.frameData!}
              peakSpeedKmh={analysis.speedKmh ?? 0}
            />
          )}

          <div className="card text-center mt-3">
            <div className="peak-speed">
              {analysis.speedKmh?.toFixed(1)} <span style={{ fontSize: "1.5rem" }}>km/h</span>
            </div>
            <p className="peak-speed-unit">{analysis.speedMph?.toFixed(1)} mph</p>

            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-value">Ice Hockey</div>
                <div className="stat-label">Sport</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {analysis.confidence != null
                    ? (analysis.confidence * 100).toFixed(0) + "%"
                    : "\u2014"}
                </div>
                <div className="stat-label">Confidence</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ fontSize: "0.875rem" }}>
                  {analysis.completedAt
                    ? new Date(analysis.completedAt).toLocaleString()
                    : "\u2014"}
                </div>
                <div className="stat-label">Completed</div>
              </div>
            </div>
          </div>
        </>
      )}

      {analysis.status === "FAILED" && (
        <div className="card text-center" style={{ padding: "3rem 2rem" }}>
          <h2 style={{ color: "var(--error)" }}>Analysis Failed</h2>
          <p>{analysis.errorMessage}</p>
        </div>
      )}

      <div className="text-center mt-3" style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
        <Link to="/upload" className="btn btn-ghost">
          Analyze another video
        </Link>
        <Link to="/history" className="btn btn-ghost">
          View History
        </Link>
      </div>
    </div>
  );
}

export default ResultPage;
