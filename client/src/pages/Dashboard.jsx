import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useAuthStore } from "../store/authStore";
import { useMeetingStore } from "../store/meetingStore";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { rooms, createRoom, fetchRooms, joinRoom, loading, error } = useMeetingStore();
  const [meetingId, setMeetingId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [form, setForm] = useState({ name: "Instant Meeting", type: "public", password: "" });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetchRooms().catch(() => {});
  }, [fetchRooms]);

  const hostedRooms = useMemo(() => rooms.filter((room) => room.hostId?._id === user?._id), [rooms, user]);

  const handleCreate = async (event) => {
    event.preventDefault();
    const room = await createRoom(form);
    navigate(`/room/${room.meetingId}`);
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    if (!meetingId.trim()) {
      return;
    }

    const room = await joinRoom(meetingId.trim().toUpperCase(), joinPassword);
    navigate(`/room/${room.meetingId}`);
  };

  const copyInvite = async (room) => {
    const url = `${window.location.origin}/room/${room.meetingId}`;
    await navigator.clipboard.writeText(url);
    setNotice(`Invite copied for ${room.name}`);
    setTimeout(() => setNotice(""), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <Navbar />
      <div className="flex min-h-[calc(100vh-73px)]">
        <Sidebar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Dashboard</p>
              <h1 className="mt-2 text-4xl font-black">Welcome, {user?.name}</h1>
            </div>
            <button onClick={() => navigate("/history")} className="secondary-button" type="button">
              View meeting history
            </button>
          </div>

          {(error || notice) && (
            <p className={`mb-6 rounded-2xl p-3 text-sm font-semibold ${error ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
              {error || notice}
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-black">Create meeting</h2>
              <form onSubmit={handleCreate} className="mt-6 space-y-4">
                <input
                  className="field"
                  value={form.name}
                  onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                  placeholder="Meeting name"
                  required
                />
                <select
                  className="field"
                  value={form.type}
                  onChange={(event) => setForm((state) => ({ ...state, type: event.target.value }))}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="team">Team</option>
                </select>
                {form.type === "private" && (
                  <input
                    className="field"
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
                    placeholder="Room password"
                    minLength={4}
                    required
                  />
                )}
                <button className="primary-button w-full" type="submit" disabled={loading}>
                  Create and start
                </button>
              </form>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-black">Join meeting</h2>
              <form onSubmit={handleJoin} className="mt-6 space-y-4">
                <input className="field" value={meetingId} onChange={(event) => setMeetingId(event.target.value)} placeholder="Meeting ID" />
                <input className="field" type="password" value={joinPassword} onChange={(event) => setJoinPassword(event.target.value)} placeholder="Room password if required" />
                <button className="secondary-button w-full" type="submit" disabled={loading}>
                  Join meeting
                </button>
              </form>
            </section>
          </div>

          <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-black">Your rooms</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => (
                <article key={room._id} className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{room.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">ID: {room.meetingId}</p>
                      <p className="mt-1 text-sm text-slate-500">{room.type} room</p>
                    </div>
                    {hostedRooms.some((hosted) => hosted._id === room._id) && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Host</span>
                    )}
                  </div>
                  <div className="mt-5 flex gap-2">
                    <button onClick={() => navigate(`/room/${room.meetingId}`)} className="primary-button !rounded-xl !px-4 !py-2" type="button">
                      Open
                    </button>
                    <button onClick={() => copyInvite(room)} className="secondary-button !rounded-xl !px-4 !py-2" type="button">
                      Copy invite
                    </button>
                  </div>
                </article>
              ))}
              {rooms.length === 0 && <p className="text-slate-500">No rooms yet. Create your first meeting above.</p>}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
