import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  getAnalysisHistory,
  type AnalysisListItem,
  type PagedResponse,
} from "../api/videoApi";

function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentPage = Number(searchParams.get("page") ?? "0");

  const [data, setData] = useState<PagedResponse<AnalysisListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAnalysisHistory(currentPage, 10)
      .then(setData)
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, [currentPage]);

  const goToPage = (page: number) => {
    setSearchParams({ page: String(page) });
  };

  if (loading) {
    return (
      <div className="page text-center mt-4">
        <div className="spinner" />
        <p className="mt-2" style={{ color: "var(--text-muted)" }}>Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page text-center mt-4">
        <p className="error-text mb-2">{error}</p>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.content.length === 0) {
    return (
      <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <div className="text-center">
          <h2 style={{ marginBottom: "0.5rem" }}>No measurements yet</h2>
          <p style={{ marginBottom: "1.5rem" }}>Upload a video to get your first speed analysis.</p>
          <Link to="/upload" className="btn btn-primary">Upload Video</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: "1.25rem" }}>Measurement History</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {data.content.map((item) => (
          <div
            key={item.analysisId}
            className="card"
            style={{ padding: "1.25rem 1.5rem", cursor: "pointer", transition: "border-color 0.2s" }}
            onClick={() => navigate(`/result/${item.analysisId}`)}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.videoFilename}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span>{item.sportType.replace("_", " ")}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  {item.confidence != null && (
                    <span>{(item.confidence * 100).toFixed(0)}% confidence</span>
                  )}
                </div>
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {item.status === "COMPLETED" && item.speedKmh != null ? (
                  <>
                    <div style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                      {item.speedKmh.toFixed(1)} <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>km/h</span>
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      {item.speedMph?.toFixed(1)} mph
                    </div>
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      padding: "0.25rem 0.625rem",
                      borderRadius: "6px",
                      background: item.status === "FAILED" ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)",
                      color: item.status === "FAILED" ? "var(--error)" : "var(--accent)",
                    }}
                  >
                    {item.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginTop: "1.5rem" }}>
          <button
            className="btn btn-ghost"
            disabled={currentPage === 0}
            onClick={() => goToPage(currentPage - 1)}
          >
            Previous
          </button>
          <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Page {currentPage + 1} of {data.totalPages}
          </span>
          <button
            className="btn btn-ghost"
            disabled={currentPage >= data.totalPages - 1}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
