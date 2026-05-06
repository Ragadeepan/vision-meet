import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useMeetingStore } from "../store/meetingStore";

const Navbar = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuthStore();
  const { darkMode, toggleDarkMode } = useMeetingStore();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to={token ? "/dashboard" : "/"} className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 font-black text-white">
            VM
          </span>
          <span className="text-xl font-bold text-slate-950 dark:text-white">Vision Meeting</span>
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          {token && (
            <>
              <NavLink className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300" to="/dashboard">
                Dashboard
              </NavLink>
              <NavLink className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300" to="/history">
                History
              </NavLink>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            {darkMode ? "Light" : "Dark"}
          </button>
          {token ? (
            <>
              <span className="hidden text-sm text-slate-600 dark:text-slate-300 sm:inline">{user?.name}</span>
              <button onClick={handleLogout} className="secondary-button !px-4 !py-2" type="button">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="secondary-button !px-4 !py-2">
                Login
              </Link>
              <Link to="/signup" className="primary-button !px-4 !py-2">
                Signup
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
