import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import UploadPage from "./pages/UploadPage";
import ResultPage from "./pages/ResultPage";
import HistoryPage from "./pages/HistoryPage";

function App() {
  return (
    <BrowserRouter>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            Speed<span>R</span>
          </Link>
          <nav style={{ marginLeft: "auto" }}>
            <Link to="/history" className="btn btn-ghost" style={{ fontSize: "0.875rem" }}>
              History
            </Link>
          </nav>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/result/:analysisId" element={<ResultPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
