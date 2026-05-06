import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuthStore } from "../store/authStore";

const phoneRegex = /^\+?[1-9]\d{7,14}$/;

const Signup = () => {
  const navigate = useNavigate();
  const { signup, loginWithGoogle, loading, error } = useAuthStore();
  const [clientError, setClientError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const updateField = (field) => (event) => setForm((state) => ({ ...state, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setClientError("");

    if (form.password !== form.confirmPassword) {
      setClientError("Passwords do not match.");
      return;
    }

    if (form.password.length < 6) {
      setClientError("Password must be at least 6 characters.");
      return;
    }

    if (!phoneRegex.test(form.phone)) {
      setClientError("Use a valid phone number such as +14155552671.");
      return;
    }

    try {
      await signup(form);
      navigate("/dashboard");
    } catch (_error) {
      // Error is already displayed from the auth store.
    }
  };

  const handleGoogleSignup = async () => {
    try {
      await loginWithGoogle();
      navigate("/dashboard");
    } catch (_error) {
      // Error is already displayed from the auth store.
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="mx-auto flex max-w-lg flex-col justify-center px-4 py-16">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-3xl font-black text-slate-950 dark:text-white">Create your account</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Start secure meetings in seconds.</p>

          {(clientError || error) && (
            <p className="mt-4 rounded-2xl bg-rose-100 p-3 text-sm font-semibold text-rose-700">{clientError || error}</p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input className="field" placeholder="Full name" value={form.name} onChange={updateField("name")} required />
            <input className="field" placeholder="Phone number with country code" value={form.phone} onChange={updateField("phone")} required />
            <input className="field" type="email" placeholder="Email" value={form.email} onChange={updateField("email")} required />
            <input className="field" type="password" placeholder="Password" value={form.password} onChange={updateField("password")} required minLength={6} />
            <input className="field" type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={updateField("confirmPassword")} required minLength={6} />
            <button className="primary-button w-full" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Signup"}
            </button>
          </form>

          <button type="button" onClick={handleGoogleSignup} className="secondary-button mt-4 block w-full text-center" disabled={loading}>
            Signup with Google
          </button>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-blue-600">
              Login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Signup;
