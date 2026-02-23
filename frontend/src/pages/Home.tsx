import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <div className="text-center">
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
          Measure Your Speed
        </h1>
        <p style={{ fontSize: "1.125rem", maxWidth: 420, margin: "0 auto 2.5rem" }}>
          Upload an ice hockey video and get instant stick swing speed analysis powered by computer vision.
        </p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/upload" className="btn btn-primary" style={{ fontSize: "1.0625rem", padding: "0.8rem 2.5rem" }}>
            Upload Video
          </Link>
          <Link to="/history" className="btn btn-ghost">
            View History
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
