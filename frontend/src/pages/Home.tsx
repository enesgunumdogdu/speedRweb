import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

function Home() {
  const [status, setStatus] = useState<string>("...");

  useEffect(() => {
    api
      .get("/health")
      .then((res) => setStatus(res.data.status))
      .catch(() => setStatus("offline"));
  }, []);

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <div className="text-center">
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
          Measure Your Speed
        </h1>
        <p style={{ fontSize: "1.125rem", maxWidth: 420, margin: "0 auto 2.5rem" }}>
          Upload an ice hockey video and get instant stick swing speed analysis powered by computer vision.
        </p>

        <Link to="/upload" className="btn btn-primary" style={{ fontSize: "1.0625rem", padding: "0.8rem 2.5rem" }}>
          Upload Video
        </Link>

        <p style={{ marginTop: "3rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          Backend: {status}
        </p>
      </div>
    </div>
  );
}

export default Home;
