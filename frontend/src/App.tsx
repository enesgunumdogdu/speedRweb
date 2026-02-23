import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import UploadPage from "./pages/UploadPage";
import ResultPage from "./pages/ResultPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          Speed<span>R</span>
        </Link>
        <nav className="header-nav">
          {isAuthenticated ? (
            <>
              <span className="header-user">{user?.displayName}</span>
              <Link to="/history" className="btn btn-ghost" style={{ fontSize: "0.875rem" }}>
                History
              </Link>
              <button onClick={handleLogout} className="btn btn-ghost" style={{ fontSize: "0.875rem" }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost" style={{ fontSize: "0.875rem" }}>
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}>
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
        <Route path="/result/:analysisId" element={<ProtectedRoute><ResultPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
