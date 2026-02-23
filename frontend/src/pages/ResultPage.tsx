import { useEffect, useState, useMemo } from "react";
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

  const frameStats = useMemo(() => {
    if (!analysis?.frameData) return null;
    const { frameSpeeds, fps } = analysis.frameData;
    const nonZero = frameSpeeds.filter((s) => s > 0);
    const avg = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
    const duration = frameSpeeds.length / fps;
    return { avg, duration, totalFrames: frameSpeeds.length, fps };
  }, [analysis]);

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

          {/* Results card */}
          <div className="card mt-3">
            <div className="result-header">
              <div className="result-peak">
                <span className="result-peak-label">Peak Speed</span>
                <div className="result-peak-row">
                  <span className="result-peak-value">{analysis.speedKmh?.toFixed(1)}</span>
                  <span className="result-peak-unit">km/h</span>
                </div>
                <span className="result-peak-alt">{analysis.speedMph?.toFixed(1)} mph</span>
              </div>

              {frameStats && (
                <div className="result-avg">
                  <span className="result-avg-label">Average Speed</span>
                  <div className="result-avg-row">
                    <span className="result-avg-value">{frameStats.avg.toFixed(1)}</span>
                    <span className="result-avg-unit">km/h</span>
                  </div>
                  <span className="result-avg-alt">{(frameStats.avg * 0.621371).toFixed(1)} mph</span>
                </div>
              )}
            </div>

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
              {frameStats && (
                <>
                  <div className="stat-card">
                    <div className="stat-value">{frameStats.duration.toFixed(1)}s</div>
                    <div className="stat-label">Duration</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{frameStats.totalFrames}</div>
                    <div className="stat-label">Frames</div>
                  </div>
                </>
              )}
            </div>

            {analysis.completedAt && (
              <p className="result-timestamp">
                Analyzed on {new Date(analysis.completedAt).toLocaleString()}
              </p>
            )}
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
