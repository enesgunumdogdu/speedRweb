import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAnalysis, type AnalysisResponse } from "../api/videoApi";

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
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem" }}>
        <p style={{ color: "#d32f2f" }}>{error}</p>
        <Link to="/upload">Try again</Link>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const isPending =
    analysis.status === "PENDING" || analysis.status === "PROCESSING";

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem" }}>
      <h1>Analysis Result</h1>

      {isPending && (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <p style={{ fontSize: "1.25rem", color: "#666" }}>
            Analyzing video...
          </p>
          <p style={{ color: "#999" }}>
            Status: {analysis.status}
          </p>
        </div>
      )}

      {analysis.status === "COMPLETED" && (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <div
            style={{
              fontSize: "3rem",
              fontWeight: 700,
              color: "#1976d2",
              marginBottom: "0.5rem",
            }}
          >
            {analysis.speedKmh?.toFixed(1)} km/h
          </div>
          <div
            style={{
              fontSize: "1.5rem",
              color: "#666",
              marginBottom: "1.5rem",
            }}
          >
            {analysis.speedMph?.toFixed(1)} mph
          </div>

          <table
            style={{
              margin: "0 auto",
              textAlign: "left",
              borderCollapse: "collapse",
            }}
          >
            <tbody>
              <tr>
                <td style={{ padding: "0.5rem 1rem", color: "#888" }}>Sport</td>
                <td style={{ padding: "0.5rem 1rem" }}>Ice Hockey</td>
              </tr>
              <tr>
                <td style={{ padding: "0.5rem 1rem", color: "#888" }}>Confidence</td>
                <td style={{ padding: "0.5rem 1rem" }}>
                  {analysis.confidence != null
                    ? (analysis.confidence * 100).toFixed(0) + "%"
                    : "—"}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "0.5rem 1rem", color: "#888" }}>Completed</td>
                <td style={{ padding: "0.5rem 1rem" }}>
                  {analysis.completedAt
                    ? new Date(analysis.completedAt).toLocaleString()
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {analysis.status === "FAILED" && (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <p style={{ color: "#d32f2f", fontSize: "1.25rem" }}>
            Analysis failed
          </p>
          <p style={{ color: "#888" }}>{analysis.errorMessage}</p>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link
          to="/upload"
          style={{
            color: "#1976d2",
            textDecoration: "none",
            fontSize: "1rem",
          }}
        >
          Analyze another video
        </Link>
      </div>
    </div>
  );
}

export default ResultPage;
