import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import UploadPage from "./pages/UploadPage";
import ResultPage from "./pages/ResultPage";

function App() {
  return (
    <BrowserRouter>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            Speed<span>R</span>
          </Link>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/result/:analysisId" element={<ResultPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
