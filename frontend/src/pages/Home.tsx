import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

function Home() {
  const [status, setStatus] = useState<string>("loading...");

  useEffect(() => {
    api
      .get("/health")
      .then((res) => setStatus(res.data.status))
      .catch(() => setStatus("Backend unreachable"));
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem", textAlign: "center" }}>
      <h1>SpeedRweb</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Video-based speed measurement for ice hockey
      </p>

      <Link
        to="/upload"
        style={{
          display: "inline-block",
          padding: "0.75rem 2rem",
          fontSize: "1.125rem",
          backgroundColor: "#1976d2",
          color: "#fff",
          textDecoration: "none",
          borderRadius: 4,
        }}
      >
        Upload Video
      </Link>

      <p style={{ marginTop: "2rem", fontSize: "0.875rem", color: "#999" }}>
        Backend: {status}
      </p>
    </div>
  );
}

export default Home;
