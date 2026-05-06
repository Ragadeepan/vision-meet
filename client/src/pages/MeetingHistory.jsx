import { useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useMeetingStore } from "../store/meetingStore";

const formatDuration = (meeting) => {
  if (!meeting.startTime || !meeting.endTime) {
    return "In progress";
  }

  const milliseconds = new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime();
  const minutes = Math.max(1, Math.round(milliseconds / 60000));
  return `${minutes} min`;
};

const MeetingHistory = () => {
  const { history, fetchHistory, loading, error } = useMeetingStore();

  useEffect(() => {
    fetchHistory().catch(() => {});
  }, [fetchHistory]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <Navbar />
      <div className="flex min-h-[calc(100vh-73px)]">
        <Sidebar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Recordings</p>
            <h1 className="mt-2 text-4xl font-black">Meeting History</h1>
          </div>

          {loading && <p className="text-slate-500">Loading history...</p>}
          {error && <p className="rounded-2xl bg-rose-100 p-3 text-sm font-semibold text-rose-700">{error}</p>}

          <div className="grid gap-5">
            {history.map((meeting) => (
              <article key={meeting._id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                  <div>
                    <h2 className="text-2xl font-black">{meeting.roomId?.name || "Meeting"}</h2>
                    <p className="mt-2 text-sm text-slate-500">Meeting ID: {meeting.roomId?.meetingId}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Started {new Date(meeting.startTime).toLocaleString()} - Duration {formatDuration(meeting)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{meeting.participants?.length || 0} participant(s)</p>
                  </div>
                  {meeting.recordingUrl ? (
                    <div className="w-full max-w-md space-y-3">
                      <video src={meeting.recordingUrl} controls className="w-full rounded-2xl bg-black" />
                      <a href={meeting.recordingUrl} download className="secondary-button block text-center" target="_blank" rel="noreferrer">
                        Download recording
                      </a>
                    </div>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      No recording uploaded
                    </span>
                  )}
                </div>
              </article>
            ))}

            {!loading && history.length === 0 && (
              <p className="rounded-[2rem] border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
                Your completed meetings will appear here.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MeetingHistory;
