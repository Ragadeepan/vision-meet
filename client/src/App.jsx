import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import MeetingHistory from "./pages/MeetingHistory";
import Room from "./pages/Room";
import Signup from "./pages/Signup";
import { useAuthStore } from "./store/authStore";
import { useMeetingStore } from "./store/meetingStore";

const ProtectedRoute = ({ children }) => {
  const { token, authReady } = useAuthStore();
  if (!authReady && !token) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <p className="text-lg font-semibold">Checking your session...</p>
      </div>
    );
  }
  return token ? children : <Navigate to="/login" replace />;
};

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchMe, setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      navigate("/login?error=google-auth-failed", { replace: true });
      return;
    }

    setAuth({ token, user: null });
    fetchMe().finally(() => navigate("/dashboard", { replace: true }));
  }, [fetchMe, navigate, searchParams, setAuth]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 text-white">
      <p className="text-lg font-semibold">Completing Google login...</p>
    </div>
  );
};

const AppRoutes = () => {
  const { hydrateTheme } = useMeetingStore();
  const { token, fetchMe, initializeAuth } = useAuthStore();

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => initializeAuth(), [initializeAuth]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe, token]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/success" element={<AuthSuccess />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/room/:roomId"
        element={
          <ProtectedRoute>
            <Room />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <MeetingHistory />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => (
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);

export default App;
