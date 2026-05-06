import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuthStore } from "../store/authStore";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle, loading, error } = useAuthStore();
  const [form, setForm] = useState({ email: "", password: "" });

  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/dashboard";

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await login(form);
      navigate(next);
    } catch (_error) {
      // Error is already displayed from the auth store.
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      navigate(next);
    } catch (_error) {
      // Error is already displayed from the auth store.
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-3xl font-black text-slate-950 dark:text-white">Welcome back</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Login to continue to your meetings.</p>

          {error && <p className="mt-4 rounded-2xl bg-rose-100 p-3 text-sm font-semibold text-rose-700">{error}</p>}
          {params.get("error") && (
            <p className="mt-4 rounded-2xl bg-rose-100 p-3 text-sm font-semibold text-rose-700">
              Google login failed. Please try again.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              className="field"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm((state) => ({ ...state, email: event.target.value }))}
              required
            />
            <input
              className="field"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
              required
              minLength={6}
            />
            <button className="primary-button w-full" type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <button type="button" onClick={handleGoogleLogin} className="secondary-button mt-4 block w-full text-center" disabled={loading}>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
            New here?{" "}
            <Link to="/signup" className="font-bold text-blue-600">
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;
