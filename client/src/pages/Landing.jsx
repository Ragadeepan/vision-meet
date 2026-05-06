import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuthStore } from "../store/authStore";

const Landing = () => {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [meetingId, setMeetingId] = useState("");

  const startPath = token ? "/dashboard" : "/signup";

  const handleJoin = (event) => {
    event.preventDefault();
    if (meetingId.trim()) {
      const normalizedMeetingId = meetingId.trim().toUpperCase();
      navigate(token ? `/room/${normalizedMeetingId}` : `/login?next=/room/${normalizedMeetingId}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <Navbar />
      <main className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <section className="flex flex-col justify-center">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-blue-600">Real-time collaboration</p>
          <h1 className="text-5xl font-black leading-tight sm:text-6xl">
            Video meetings built for teams that move fast.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Vision Meeting brings secure rooms, live video, chat, screen sharing, recordings, and meeting history into one modern web app.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to={startPath} className="primary-button text-center">
              Start Meeting
            </Link>
            <a href="#join" className="secondary-button text-center">
              Join Meeting
            </a>
          </div>
        </section>

        <section className="glass-panel rounded-[2rem] p-6">
          <div className="rounded-[1.5rem] bg-slate-950 p-4">
            <div className="grid grid-cols-2 gap-3">
              {["Host", "Design", "Product", "Guest"].map((name) => (
                <div key={name} className="grid aspect-video place-items-center rounded-3xl bg-slate-800">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-blue-600 text-xl font-black text-white">
                    {name[0]}
                  </div>
                  <span className="text-sm font-semibold text-white">{name}</span>
                </div>
              ))}
            </div>
          </div>

          <form id="join" onSubmit={handleJoin} className="mt-6 space-y-4">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Join with meeting ID</label>
            <input
              value={meetingId}
              onChange={(event) => setMeetingId(event.target.value)}
              className="field"
              placeholder="Example: A1B2C3D4"
            />
            <button className="primary-button w-full" type="submit">
              Join Now
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Landing;
