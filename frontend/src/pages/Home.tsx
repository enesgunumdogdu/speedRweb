import { useEffect, useState } from "react";
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
    <div>
      <h1>SpeedRweb</h1>
      <p>Backend status: {status}</p>
    </div>
  );
}

export default Home;
